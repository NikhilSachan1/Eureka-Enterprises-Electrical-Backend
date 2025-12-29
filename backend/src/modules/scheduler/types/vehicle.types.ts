/**
 * Vehicle Document Expiry Alert Types
 *
 * CRON 11: Vehicle Document Expiry Alerts
 *
 * Sends alerts for vehicles with expiring or expired documents:
 * - Insurance (insuranceEndDate)
 * - PUC / Pollution Certificate (pucEndDate)
 * - Fitness Certificate (fitnessEndDate)
 *
 * Alert Levels:
 * - EXPIRED: Document has already expired
 * - EXPIRING_SOON: Document expires within configured warning days (default: 30)
 *
 * Recipients:
 * - Fleet manager / Admin
 * - Assigned user (if vehicle is assigned)
 */

export interface VehicleDocumentExpiryResult {
  totalVehiclesProcessed: number;
  expiredDocuments: DocumentExpiryCount;
  expiringSoonDocuments: DocumentExpiryCount;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface DocumentExpiryCount {
  insurance: number;
  puc: number;
  fitness: number;
  total: number;
}

export interface VehicleDocumentAlert {
  vehicleId: string;
  vehicleMasterId: string;
  registrationNo: string;
  number: string;
  brand: string;
  model: string;
  assignedTo: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  documents: DocumentAlert[];
}

export interface DocumentAlert {
  type: VehicleDocumentType;
  label: string;
  endDate: Date;
  daysUntilExpiry: number;
  status: DocumentAlertStatus;
}

export enum VehicleDocumentType {
  INSURANCE = 'insurance',
  PUC = 'puc',
  FITNESS = 'fitness',
}

export enum DocumentAlertStatus {
  EXPIRED = 'EXPIRED',
  EXPIRING_SOON = 'EXPIRING_SOON',
}

export interface VehicleDocumentEmailData {
  currentYear: number;
  adminPortalUrl: string;
  totalExpired: number;
  totalExpiringSoon: number;
  expiredVehicles: VehicleDocumentEmailItem[];
  expiringSoonVehicles: VehicleDocumentEmailItem[];
  hasExpired: boolean;
  hasExpiringSoon: boolean;
}

export interface VehicleDocumentEmailItem {
  registrationNo: string;
  vehicleNumber: string;
  brand: string;
  model: string;
  assignedTo: string;
  documents: DocumentEmailItem[];
}

export interface DocumentEmailItem {
  type: string;
  label: string;
  endDate: string;
  daysText: string;
  statusClass: string;
}

/**
 * Vehicle Service Due Reminder Types
 *
 * CRON 12: Vehicle Service Due Reminders
 *
 * Sends alerts for vehicles with service due based on KM:
 * - OVERDUE: Current KM > Next Service Due KM
 * - DUE_SOON: Current KM is within warning threshold of Next Service Due KM
 *
 * Calculation:
 * - nextServiceDueKm = lastServiceKm + serviceIntervalKm (default: 10000)
 * - kmToNextService = nextServiceDueKm - currentOdometerKm
 * - If kmToNextService <= 0 → OVERDUE
 * - If kmToNextService <= warningKm (default: 1000) → DUE_SOON
 */

export interface VehicleServiceDueResult {
  totalVehiclesProcessed: number;
  overdueCount: number;
  dueSoonCount: number;
  skippedNoServiceHistory: number;
  skippedNoOdometer: number;
  emailsSent: number;
  recipients: string[];
  errors: string[];
}

export interface VehicleServiceAlert {
  vehicleMasterId: string;
  registrationNo: string;
  number: string;
  brand: string;
  model: string;
  assignedTo: string | null;
  assignedUserName: string | null;
  assignedUserEmail: string | null;
  lastServiceKm: number;
  lastServiceDate: Date | null;
  currentOdometerKm: number;
  nextServiceDueKm: number;
  kmToNextService: number;
  kmSinceLastService: number;
  status: ServiceDueAlertStatus;
}

export enum ServiceDueAlertStatus {
  OVERDUE = 'OVERDUE',
  DUE_SOON = 'DUE_SOON',
}

export interface VehicleServiceDueEmailData {
  currentYear: number;
  adminPortalUrl: string;
  serviceIntervalKm: number;
  warningKm: number;
  totalOverdue: number;
  totalDueSoon: number;
  overdueVehicles: VehicleServiceEmailItem[];
  dueSoonVehicles: VehicleServiceEmailItem[];
  hasOverdue: boolean;
  hasDueSoon: boolean;
}

export interface VehicleServiceEmailItem {
  registrationNo: string;
  vehicleNumber: string;
  brand: string;
  model: string;
  assignedTo: string;
  lastServiceKm: string;
  lastServiceDate: string;
  currentOdometerKm: string;
  nextServiceDueKm: string;
  kmStatus: string;
  statusClass: string;
}
