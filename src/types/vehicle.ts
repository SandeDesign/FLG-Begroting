export type FuelType = 'electric' | 'petrol' | 'diesel' | 'hybrid';

export type VehicleReportType = 'damage' | 'malfunction' | 'maintenance_due' | 'other';

export type VehicleReportStatus = 'open' | 'in_progress' | 'resolved';

export type VehicleStatusLevel = 'ok' | 'soon' | 'overdue';

export interface Vehicle {
  id?: string;
  userId: string; // Admin-namespace (eigenaar van de data)
  companyId: string;

  kenteken: string;
  assignedToEmployeeId?: string;

  make: string; // Merk
  model: string;
  year?: number;
  vin?: string;
  fuelType: FuelType;
  fuelCardNumber?: string; // Tankpas — tanken loopt via deze pas

  currentMileage?: number;

  apkExpiryDate?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  maintenanceIntervalKm?: number; // Onderhoudsinterval in km
  lastMaintenanceMileage?: number;

  insurer?: string;
  policyNumber?: string;

  notes?: string;

  // Idempotentie-markers: ISO-datum (yyyy-mm-dd) waarvoor al een APK/onderhoud-taak
  // is aangemaakt, zodat er niet bij elke pagina-load dubbele taken ontstaan.
  apkTaskCreatedFor?: string;
  maintenanceTaskCreatedFor?: string;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleMileageLog {
  id?: string;
  userId: string;
  companyId: string;
  vehicleId: string;
  mileage: number;
  date: Date;
  employeeId?: string;
  source: 'timesheet' | 'manual';
  createdAt: Date;
}

export interface VehicleTaskTrip {
  description: string;
  kilometers: number;
  isRiset?: boolean; // true = Riset/ITKnecht-import, anders een handmatige taak
}

/**
 * Persistente dag-rit-log per auto. Wordt opgeslagen bij het opslaan/indienen van
 * een urenstaat zodat de historie op de auto compleet blijft, óók als de auto later
 * aan een andere monteur wordt gekoppeld (employeeName is een snapshot).
 */
export interface VehicleTripLog {
  id?: string; // deterministisch: `${timesheetId}_${dayIndex}`
  userId: string;
  companyId: string;
  vehicleId: string;
  vehicleKenteken?: string;
  employeeId?: string;
  employeeName?: string;
  date: Date;
  startKilometers?: number;
  endKilometers?: number;
  dayKilometers: number;
  taskTrips?: VehicleTaskTrip[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VehicleReport {
  id?: string;
  userId: string; // Admin-namespace
  companyId: string;
  vehicleId: string;
  vehicleKenteken?: string;
  reportedByEmployeeId: string;
  reportedByName?: string;
  type: VehicleReportType;
  description: string;
  photoUrls?: string[];
  status: VehicleReportStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
