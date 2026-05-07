import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklyTimesheet, TimesheetEntry } from '../types/timesheet';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.date && typeof converted.date.toDate === 'function') {
    converted.date = converted.date.toDate();
  }
  if (converted.submittedAt && typeof converted.submittedAt.toDate === 'function') {
    converted.submittedAt = converted.submittedAt.toDate();
  }
  if (converted.approvedAt && typeof converted.approvedAt.toDate === 'function') {
    converted.approvedAt = converted.approvedAt.toDate();
  }
  if (converted.rejectedAt && typeof converted.rejectedAt.toDate === 'function') {
    converted.rejectedAt = converted.rejectedAt.toDate();
  }
  if (converted.processedAt && typeof converted.processedAt.toDate === 'function') {
    converted.processedAt = converted.processedAt.toDate();
  }
  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && typeof converted.updatedAt.toDate === 'function') {
    converted.updatedAt = converted.updatedAt.toDate();
  }

  if (converted.entries && Array.isArray(converted.entries)) {
    converted.entries = converted.entries.map((entry: any) => convertTimestamps(entry));
  }

  return converted;
};

/**
 * Strip undefined keys recursief (Firestore weigert undefined waarden).
 * Null wordt wél behouden — null is een geldige Firestore-waarde, undefined niet.
 */
const stripUndefined = <T extends Record<string, any>>(data: T): T => {
  const out: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
};

const convertToTimestamps = (data: any) => {
  // Eerst undefined-keys eruit filteren zodat Firestore niet klapt op
  // optionele velden die niet gezet zijn (bv. branchId, effortNote,
  // statusReason, lockedAt op oude entries).
  const converted: any = stripUndefined({ ...data });

  if (converted.date instanceof Date) {
    converted.date = Timestamp.fromDate(converted.date);
  }
  if (converted.submittedAt instanceof Date) {
    converted.submittedAt = Timestamp.fromDate(converted.submittedAt);
  }
  if (converted.approvedAt instanceof Date) {
    converted.approvedAt = Timestamp.fromDate(converted.approvedAt);
  }
  if (converted.rejectedAt instanceof Date) {
    converted.rejectedAt = Timestamp.fromDate(converted.rejectedAt);
  }
  if (converted.processedAt instanceof Date) {
    converted.processedAt = Timestamp.fromDate(converted.processedAt);
  }
  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.updatedAt instanceof Date) {
    converted.updatedAt = Timestamp.fromDate(converted.updatedAt);
  }
  if (converted.lockedAt instanceof Date) {
    converted.lockedAt = Timestamp.fromDate(converted.lockedAt);
  }
  // Genest object: lowHoursReview.submittedAt → Timestamp
  if (converted.lowHoursReview) {
    converted.lowHoursReview = stripUndefined({ ...converted.lowHoursReview });
    if (converted.lowHoursReview.submittedAt instanceof Date) {
      converted.lowHoursReview.submittedAt = Timestamp.fromDate(converted.lowHoursReview.submittedAt);
    }
  }

  if (converted.entries && Array.isArray(converted.entries)) {
    converted.entries = converted.entries.map((entry: any) => convertToTimestamps(entry));
  }

  return converted;
};

export const getWeeklyTimesheets = async (
  adminUserId: string,
  employeeId?: string,
  year?: number,
  weekNumber?: number
): Promise<WeeklyTimesheet[]> => {
  let q = query(
    collection(db, 'weeklyTimesheets'),
    where('userId', '==', adminUserId),
    orderBy('year', 'desc'),
    orderBy('weekNumber', 'desc')
  );

  if (employeeId) {
    q = query(
      collection(db, 'weeklyTimesheets'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('year', 'desc'),
      orderBy('weekNumber', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  let timesheets = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as WeeklyTimesheet));

  if (year) {
    timesheets = timesheets.filter(t => t.year === year);
  }

  if (weekNumber) {
    timesheets = timesheets.filter(t => t.weekNumber === weekNumber);
  }

  return timesheets;
};

export const getWeeklyTimesheet = async (id: string, userId: string): Promise<WeeklyTimesheet | null> => {
  const docRef = doc(db, 'weeklyTimesheets', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }

  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as WeeklyTimesheet;
};

export const createWeeklyTimesheet = async (
  userId: string,
  timesheet: Omit<WeeklyTimesheet, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const timesheetData = convertToTimestamps({
    ...timesheet,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'weeklyTimesheets'), timesheetData);
  return docRef.id;
};

export const updateWeeklyTimesheet = async (
  id: string,
  userId: string,
  updates: Partial<WeeklyTimesheet>
): Promise<void> => {
  const docRef = doc(db, 'weeklyTimesheets', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  await updateDoc(docRef, updateData);
};

/**
 * Error die wordt gegooid wanneer een week niet ingediend kan worden
 * omdat niet alle werkdagen een status hebben.
 */
export class IncompleteWeekError extends Error {
  missingDates: Date[];
  constructor(missingDates: Date[]) {
    super('Week is niet compleet: nog werkdagen zonder status.');
    this.name = 'IncompleteWeekError';
    this.missingDates = missingDates;
  }
}

// Gereserveerde term: alleen automatische ITKnecht-import mag "Riset" in
// notes/beschrijvingen schrijven. Voorkomt dat een monteur valse uren
// onder die naam registreert (omzeiling van client-side blokkade via
// dev-tools).
const FORBIDDEN_RISET = /\briset\b/i;
const ALLOWED_ITKNECHT_NOTES = /^productie uren riset$/i;

export const submitWeeklyTimesheet = async (
  id: string,
  userId: string,
  submittedBy: string
): Promise<void> => {
  // Valideer gaploosheid: alle werkdagen moeten een dayStatus hebben
  // (of — voor legacy entries — uren > 0 die als 'worked' tellen).
  const ts = await getWeeklyTimesheet(id, userId);
  if (!ts) throw new Error('Weekbriefje niet gevonden.');

  for (const entry of ts.entries) {
    // Notes mag de gereserveerde marker zijn (ITKnecht), maar geen andere
    // tekst die "Riset" bevat. statusReason en effortNote zijn altijd
    // handmatige invoer en mogen nooit "Riset" bevatten.
    if (entry.notes && FORBIDDEN_RISET.test(entry.notes) && !ALLOWED_ITKNECHT_NOTES.test(entry.notes.trim())) {
      throw new Error('Gereserveerde term "Riset" niet toegestaan in handmatige notities.');
    }
    if (entry.statusReason && FORBIDDEN_RISET.test(entry.statusReason)) {
      throw new Error('Gereserveerde term "Riset" niet toegestaan in handmatige toelichting.');
    }
    if (entry.effortNote && FORBIDDEN_RISET.test(entry.effortNote)) {
      throw new Error('Gereserveerde term "Riset" niet toegestaan in handmatige toelichting.');
    }
    for (const wa of entry.workActivities || []) {
      if (!wa.isITKnechtImport && wa.description && FORBIDDEN_RISET.test(wa.description)) {
        throw new Error('Gereserveerde term "Riset" niet toegestaan in handmatige werkzaamheden.');
      }
    }
  }

  const { checkWeekComplete } = await import('../utils/timesheetCompliance');
  const check = checkWeekComplete(ts);
  if (!check.isComplete) {
    throw new IncompleteWeekError(check.missingDates);
  }

  await updateWeeklyTimesheet(id, userId, {
    status: 'submitted',
    submittedAt: new Date(),
    submittedBy,
    lockedAt: new Date(),
  });
};

export const approveWeeklyTimesheet = async (
  id: string,
  userId: string,
  approvedBy: string
): Promise<void> => {
  await updateWeeklyTimesheet(id, userId, {
    status: 'approved',
    approvedAt: new Date(),
    approvedBy
  });
};

export const rejectWeeklyTimesheet = async (
  id: string,
  userId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<void> => {
  await updateWeeklyTimesheet(id, userId, {
    status: 'rejected',
    rejectedAt: new Date(),
    rejectedBy,
    rejectionReason
  });
};

export const getPendingTimesheets = async (adminUserId: string, companyId: string): Promise<WeeklyTimesheet[]> => {
  console.log('getPendingTimesheets: Querying for adminUserId:', adminUserId, 'companyId:', companyId);

  const q = query(
    collection(db, 'weeklyTimesheets'),
    where('userId', '==', adminUserId),
    where('companyId', '==', companyId),
    where('status', '==', 'submitted'),
    orderBy('submittedAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  console.log('getPendingTimesheets: Found', querySnapshot.docs.length, 'pending timesheets');

  const timesheets = querySnapshot.docs.map(doc => {
    const data = doc.data();
    console.log('getPendingTimesheets: Timesheet', doc.id, 'data:', {
      userId: data.userId,
      companyId: data.companyId,
      status: data.status,
      employeeId: data.employeeId,
      weekNumber: data.weekNumber,
      year: data.year
    });
    return {
      id: doc.id,
      ...convertTimestamps(data)
    } as WeeklyTimesheet;
  });

  return timesheets;
};

// Get ALL pending timesheets without company filter (for admin approval overview)
export const getAllPendingTimesheets = async (adminUserId: string): Promise<WeeklyTimesheet[]> => {
  console.log('getAllPendingTimesheets: Querying for adminUserId:', adminUserId);

  const q = query(
    collection(db, 'weeklyTimesheets'),
    where('userId', '==', adminUserId),
    where('status', '==', 'submitted'),
    orderBy('submittedAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  console.log('getAllPendingTimesheets: Found', querySnapshot.docs.length, 'pending timesheets');

  const timesheets = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...convertTimestamps(data)
    } as WeeklyTimesheet;
  });

  return timesheets;
};

export const calculateWeekTotals = (entries: TimesheetEntry[]) => {
  return entries.reduce(
    (totals, entry) => {
      const activityHours = (entry.workActivities || [])
        .filter(wa => !wa.isITKnechtImport)
        .reduce((sum, wa) => sum + (wa.hours || 0), 0);
      return {
        regularHours: totals.regularHours + entry.regularHours + activityHours,
        overtimeHours: totals.overtimeHours + entry.overtimeHours,
        eveningHours: totals.eveningHours + entry.eveningHours,
        nightHours: totals.nightHours + entry.nightHours,
        weekendHours: totals.weekendHours + entry.weekendHours,
        travelKilometers: totals.travelKilometers + entry.travelKilometers
      };
    },
    {
      regularHours: 0,
      overtimeHours: 0,
      eveningHours: 0,
      nightHours: 0,
      weekendHours: 0,
      travelKilometers: 0
    }
  );
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Get the ISO week year for a given date
 * ISO week year can differ from calendar year (e.g., Dec 30 2024 is in week 1 of 2025)
 */
export const getISOWeekYear = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of this week
  return d.getUTCFullYear(); // Year of that Thursday
};

export const getWeekDates = (year: number, weekNumber: number): Date[] => {
  // ISO 8601: Week 1 contains the first Thursday of the year
  // Find January 4 (always in week 1), then find its Monday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // 1=Monday, 7=Sunday
  const mondayOfWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);

  // Calculate Monday of the requested week
  const weekStart = new Date(mondayOfWeek1.getTime() + (weekNumber - 1) * 7 * 86400000);

  // Return array of 7 days starting from that Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(weekStart.getTime() + i * 86400000)
  );
};