export interface IMailOptions {
  receiverEmails: string | string[];
  subject: string;
  template: string;
  emailData: IEmailDataValues;
}

export interface IEmailDataValues {
  // Common
  currentYear?: number;
  adminPortalUrl?: string;

  // Forget Password
  firstName?: string;
  lastName?: string;
  resetPasswordLink?: string;

  // FY Leave Config Reminder
  daysRemaining?: number;
  nextFinancialYear?: string;

  // Vehicle Document Expiry
  totalExpired?: number;
  totalExpiringSoon?: number;
  expiredVehicles?: VehicleDocumentEmailItem[];
  expiringSoonVehicles?: VehicleDocumentEmailItem[];
  hasExpired?: boolean;
  hasExpiringSoon?: boolean;

  // Vehicle Service Due
  serviceIntervalKm?: number;
  warningKm?: number;
  totalOverdue?: number;
  totalDueSoon?: number;
  overdueVehicles?: VehicleServiceEmailItem[];
  dueSoonVehicles?: VehicleServiceEmailItem[];
  hasOverdue?: boolean;
  hasDueSoon?: boolean;

  // Asset Calibration & Warranty Expiry
  expiredAssets?: AssetCalibrationEmailItem[] | AssetWarrantyEmailItem[];
  expiringSoonAssets?: AssetCalibrationEmailItem[] | AssetWarrantyEmailItem[];
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

export interface AssetCalibrationEmailItem {
  assetId: string;
  name: string;
  model: string;
  serialNumber: string;
  category: string;
  assetStatus: string;
  assignedTo: string;
  calibrationEndDate: string;
  calibrationFrom: string;
  calibrationFrequency: string;
  daysText: string;
  statusClass: string;
}

export interface AssetWarrantyEmailItem {
  assetId: string;
  name: string;
  model: string;
  serialNumber: string;
  category: string;
  assetStatus: string;
  assignedTo: string;
  warrantyEndDate: string;
  warrantyStartDate: string;
  vendorName: string;
  daysText: string;
  statusClass: string;
}
