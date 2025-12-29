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
