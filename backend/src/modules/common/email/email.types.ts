export interface IMailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface IMailOptions {
  receiverEmails: string | string[];
  subject: string;
  template: string;
  emailData: IEmailDataValues;
  attachments?: IMailAttachment[];
}

export interface IEmailDataValues {
  // Common
  currentYear?: number;
  adminPortalUrl?: string;
  portalUrl?: string;

  // For communication logging
  referenceId?: string;
  referenceType?: string;

  // Forget Password / Welcome Email
  firstName?: string;
  lastName?: string;
  resetPasswordLink?: string;

  // Welcome Employee
  email?: string;
  tempPassword?: string;
  employeeId?: string;
  designation?: string;
  department?: string;
  dateOfJoining?: string;
  reportingManager?: string;
  loginUrl?: string;
  companyLogo?: string;

  // Payslip / FNF
  employeeName?: string;
  monthYear?: string;
  netPayable?: string;
  companyName?: string;
  lastWorkingDate?: string;

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

  // Approval Emails - Common
  isApproved?: boolean;
  approverName?: string;
  approvalDate?: string;
  remarks?: string;

  // Attendance Approval
  attendanceDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: string;

  // Attendance Regularization
  originalStatus?: string;
  newStatus?: string;
  regularizedByName?: string;
  regularizedOn?: string;
  notes?: string;

  // Expense Approval
  expenseId?: string;
  amount?: string;
  category?: string;
  expenseDate?: string;
  description?: string;
  paymentMode?: string;

  // Fuel Expense Approval
  fuelLiters?: string;
  vehicleNumber?: string;
  fuelType?: string;
  fuelTypeClass?: string;
  fuelDate?: string;
  odometerReading?: string;
  pricePerLiter?: string;

  // Leave Approval
  applicationId?: string;
  leaveType?: string;
  leaveTypeClass?: string;
  leaveCategory?: string;
  fromDate?: string;
  toDate?: string;
  totalDays?: number;
  reason?: string;

  // Cron Failure
  jobName?: string;
  jobType?: string;
  errorMessage?: string;
  errorStack?: string;
  startedAt?: string;
  failedAt?: string;
  durationMs?: number;
  serverName?: string;
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

// Approval Email Interfaces
export interface IAttendanceApprovalEmailData {
  employeeName: string;
  isApproved: boolean;
  attendanceDate: string;
  checkInTime: string;
  checkOutTime: string;
  totalHours: string;
  approverName: string;
  approvalDate: string;
  remarks?: string;
  portalUrl: string;
}

export interface IExpenseApprovalEmailData {
  employeeName: string;
  isApproved: boolean;
  expenseId: string;
  amount: string;
  category: string;
  expenseDate: string;
  description: string;
  paymentMode: string;
  approverName: string;
  approvalDate: string;
  remarks?: string;
  portalUrl: string;
}

export interface IFuelExpenseApprovalEmailData {
  employeeName: string;
  isApproved: boolean;
  expenseId: string;
  amount: string;
  fuelLiters: string;
  vehicleNumber: string;
  fuelType: string;
  fuelTypeClass: string; // petrol | diesel | cng | electric
  fuelDate: string;
  odometerReading: string;
  pricePerLiter: string;
  approverName: string;
  approvalDate: string;
  remarks?: string;
  portalUrl: string;
}

export interface ILeaveApprovalEmailData {
  employeeName: string;
  isApproved: boolean;
  applicationId: string;
  leaveType: string;
  leaveTypeClass: string; // casual | sick | earned | unpaid | maternity | paternity | default
  leaveCategory: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  approverName: string;
  approvalDate: string;
  remarks?: string;
  portalUrl: string;
}

export interface IAttendanceRegularizationEmailData {
  employeeName: string;
  attendanceDate: string;
  originalStatus: string;
  newStatus: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: string;
  regularizedByName: string;
  regularizedOn: string;
  notes?: string;
  portalUrl: string;
}
