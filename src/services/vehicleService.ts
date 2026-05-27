import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Vehicle,
  VehicleMileageLog,
  VehicleReport,
  VehicleStatusLevel,
} from '../types/vehicle';

const VEHICLES = 'vehicles';
const MILEAGE_LOGS = 'vehicleMileageLogs';
const REPORTS = 'vehicleReports';

const DATE_FIELDS = [
  'apkExpiryDate',
  'lastMaintenanceDate',
  'nextMaintenanceDate',
  'date',
  'createdAt',
  'updatedAt',
  'resolvedAt',
];

const toDate = (val: unknown): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  if (typeof (val as Timestamp).toDate === 'function') return (val as Timestamp).toDate();
  return new Date(val as string);
};

const convertFromFirestore = <T>(data: Record<string, unknown>, id: string): T => {
  const out = { ...data, id } as Record<string, unknown>;
  for (const field of DATE_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = toDate(out[field]);
    }
  }
  return out as T;
};

const convertToFirestore = (data: Record<string, unknown>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue; // Firestore accepteert geen undefined
    out[key] = value instanceof Date ? Timestamp.fromDate(value) : value;
  }
  return out;
};

// ─── Vehicles CRUD ──────────────────────────────────────────────────────────

export const getVehicles = async (
  userId: string,
  companyId: string,
  includeInactive = false
): Promise<Vehicle[]> => {
  const q = query(
    collection(db, VEHICLES),
    where('userId', '==', userId),
    where('companyId', '==', companyId)
  );
  const snap = await getDocs(q);
  const vehicles = snap.docs.map(d => convertFromFirestore<Vehicle>(d.data() as Record<string, unknown>, d.id));
  return vehicles
    .filter(v => includeInactive || v.isActive !== false)
    .sort((a, b) => (a.kenteken || '').localeCompare(b.kenteken || ''));
};

export const getVehicleById = async (id: string): Promise<Vehicle | null> => {
  const snap = await getDoc(doc(db, VEHICLES, id));
  if (!snap.exists()) return null;
  return convertFromFirestore<Vehicle>(snap.data() as Record<string, unknown>, snap.id);
};

export const getEmployeeVehicle = async (
  userId: string,
  companyId: string,
  employeeId: string
): Promise<Vehicle | null> => {
  if (!employeeId) return null;
  // Zoek op de toewijzing binnen de admin-namespace, ONGEACHT bedrijf: een
  // auto wordt aan één persoon gekoppeld, maar de medewerker kan z'n uren onder
  // een ander entiteit (bv. werkmaatschappij) invullen dan waar de auto door de
  // manager beheerd wordt (bv. project-entiteit). companyId blijft een param
  // voor compat maar mag de match niet blokkeren.
  const q = query(
    collection(db, VEHICLES),
    where('userId', '==', userId),
    where('assignedToEmployeeId', '==', employeeId)
  );
  const snap = await getDocs(q);
  const matches = snap.docs
    .map(d => convertFromFirestore<Vehicle>(d.data() as Record<string, unknown>, d.id))
    .filter(v => v.isActive !== false);
  // Voorkeur voor de auto van het huidige bedrijf, anders de eerste actieve.
  return matches.find(v => v.companyId === companyId) || matches[0] || null;
};

export const createVehicle = async (
  vehicle: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = new Date();
  const ref = await addDoc(
    collection(db, VEHICLES),
    convertToFirestore({ ...vehicle, createdAt: now, updatedAt: now })
  );
  return ref.id;
};

export const updateVehicle = async (
  id: string,
  updates: Partial<Omit<Vehicle, 'id' | 'userId' | 'companyId' | 'createdAt'>>
): Promise<void> => {
  await updateDoc(doc(db, VEHICLES, id), convertToFirestore({ ...updates, updatedAt: new Date() }));
};

export const deleteVehicle = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, VEHICLES, id));
};

export const assignVehicleToEmployee = async (
  vehicleId: string,
  employeeId: string | null
): Promise<void> => {
  await updateDoc(doc(db, VEHICLES, vehicleId), {
    assignedToEmployeeId: employeeId || null,
    updatedAt: Timestamp.fromDate(new Date()),
  });
};

// ─── Tellerstand (mileage) ────────────────────────────────────────────────────

export const getMileageHistory = async (vehicleId: string): Promise<VehicleMileageLog[]> => {
  const q = query(collection(db, MILEAGE_LOGS), where('vehicleId', '==', vehicleId));
  const snap = await getDocs(q);
  const logs = snap.docs
    .map(d => convertFromFirestore<VehicleMileageLog>(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  // Ontdubbel: zelfde dag + zelfde stand telt als één regel.
  const seen = new Set<string>();
  return logs.filter(l => {
    const key = `${l.date ? new Date(l.date).toISOString().slice(0, 10) : '?'}-${l.mileage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Werkt de tellerstand van een auto bij. Schrijft ALLEEN een log wanneer de
 * stand daadwerkelijk hoger is dan de huidige — voorkomt dubbele/no-op regels.
 * Wordt aangeroepen vanuit de urenregistratie wanneer een eindstand wordt ingevuld.
 */
export const updateVehicleMileage = async (
  vehicleId: string,
  mileage: number,
  meta: { userId: string; companyId: string; date: Date; employeeId?: string; source?: 'timesheet' | 'manual' }
): Promise<void> => {
  if (!vehicleId || !mileage || mileage <= 0) return;

  const vehicle = await getVehicleById(vehicleId);
  // Niets doen als de stand niet daadwerkelijk gestegen is.
  if (vehicle && typeof vehicle.currentMileage === 'number' && mileage <= vehicle.currentMileage) {
    return;
  }

  await addDoc(
    collection(db, MILEAGE_LOGS),
    convertToFirestore({
      userId: meta.userId,
      companyId: meta.companyId,
      vehicleId,
      mileage,
      date: meta.date,
      employeeId: meta.employeeId,
      source: meta.source || 'timesheet',
      createdAt: new Date(),
    })
  );

  await updateDoc(doc(db, VEHICLES, vehicleId), {
    currentMileage: mileage,
    updatedAt: Timestamp.fromDate(new Date()),
  });
};

// ─── Meldingen (reports) ──────────────────────────────────────────────────────

export const getVehicleReports = async (
  userId: string,
  companyId: string,
  vehicleId?: string
): Promise<VehicleReport[]> => {
  const conditions = [where('userId', '==', userId), where('companyId', '==', companyId)];
  if (vehicleId) conditions.push(where('vehicleId', '==', vehicleId));
  const q = query(collection(db, REPORTS), ...conditions);
  const snap = await getDocs(q);
  return snap.docs
    .map(d => convertFromFirestore<VehicleReport>(d.data() as Record<string, unknown>, d.id))
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
};

export const createVehicleReport = async (
  report: Omit<VehicleReport, 'id' | 'createdAt' | 'status'> & { status?: VehicleReport['status'] }
): Promise<string> => {
  const ref = await addDoc(
    collection(db, REPORTS),
    convertToFirestore({
      ...report,
      status: report.status || 'open',
      createdAt: new Date(),
    })
  );
  return ref.id;
};

export const updateVehicleReportStatus = async (
  id: string,
  status: VehicleReport['status'],
  resolvedBy?: string
): Promise<void> => {
  await updateDoc(
    doc(db, REPORTS, id),
    convertToFirestore({
      status,
      resolvedAt: status === 'resolved' ? new Date() : undefined,
      resolvedBy: status === 'resolved' ? resolvedBy : undefined,
    })
  );
};

// ─── Status-helpers (APK & onderhoud) ─────────────────────────────────────────

const daysUntil = (date?: Date): number | null => {
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

export const getApkStatus = (vehicle: Vehicle): { level: VehicleStatusLevel; daysLeft: number | null } => {
  const daysLeft = daysUntil(vehicle.apkExpiryDate);
  if (daysLeft === null) return { level: 'ok', daysLeft: null };
  if (daysLeft < 0) return { level: 'overdue', daysLeft };
  if (daysLeft <= 30) return { level: 'soon', daysLeft };
  return { level: 'ok', daysLeft };
};

export const getMaintenanceStatus = (vehicle: Vehicle): { level: VehicleStatusLevel; reason?: string } => {
  // Op datum
  const daysLeft = daysUntil(vehicle.nextMaintenanceDate);
  let level: VehicleStatusLevel = 'ok';
  let reason: string | undefined;
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      level = 'overdue';
      reason = 'Onderhoudsdatum verstreken';
    } else if (daysLeft <= 30) {
      level = 'soon';
      reason = `Onderhoud binnen ${daysLeft} dagen`;
    }
  }

  // Op kilometerstand
  if (
    vehicle.maintenanceIntervalKm &&
    vehicle.currentMileage !== undefined &&
    vehicle.lastMaintenanceMileage !== undefined
  ) {
    const kmSince = vehicle.currentMileage - vehicle.lastMaintenanceMileage;
    const kmLeft = vehicle.maintenanceIntervalKm - kmSince;
    if (kmLeft <= 0 && level !== 'overdue') {
      level = 'overdue';
      reason = 'Onderhoudsinterval (km) overschreden';
    } else if (kmLeft <= 1000 && level === 'ok') {
      level = 'soon';
      reason = `Nog ${kmLeft} km tot onderhoud`;
    }
  }

  return { level, reason };
};
