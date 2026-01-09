import { CommunicationCategory } from '../../communication-logs/constants/communication-log.constants';

export const EMAIL_SUBJECT = {
  WELCOME_EMPLOYEE: '🎉 Welcome to Eureka HRMS - Your Account Details',
  FORGET_PASSWORD: 'Eureka HRMS - Password Reset Request',
  FY_LEAVE_CONFIG_REMINDER: 'Eureka HRMS - Financial Year Leave Configuration Reminder',
  VEHICLE_DOCUMENT_EXPIRY: 'Eureka HRMS - Vehicle Documents Expiring Soon',
  VEHICLE_DOCUMENT_EXPIRY_URGENT: '🚨 URGENT: Eureka HRMS - Vehicle Documents Expired',
  VEHICLE_SERVICE_DUE: 'Eureka HRMS - Vehicle Service Due Reminder',
  VEHICLE_SERVICE_DUE_URGENT: '🚨 URGENT: Eureka HRMS - Vehicle Service Overdue',
  ASSET_CALIBRATION_EXPIRY: 'Eureka HRMS - Asset Calibration Expiring Soon',
  ASSET_CALIBRATION_EXPIRY_URGENT: '🚨 URGENT: Eureka HRMS - Asset Calibration Expired',
  ASSET_WARRANTY_EXPIRY: 'Eureka HRMS - Asset Warranty Expiring Soon',
  ASSET_WARRANTY_EXPIRY_URGENT: '🚨 URGENT: Eureka HRMS - Asset Warranty Expired',
  CARD_EXPIRY: 'Eureka HRMS - Cards Expiring Soon',
  CARD_EXPIRY_URGENT: '🚨 URGENT: Eureka HRMS - Cards Expired',
  PENDING_EXPENSE_REMINDER: 'Eureka HRMS - Pending Expense Approvals',
  PENDING_EXPENSE_REMINDER_URGENT: '🚨 ACTION REQUIRED: Eureka HRMS - Overdue Expense Approvals',
  // Celebration wishes
  BIRTHDAY_WISH: '🎂 Happy Birthday from Eureka HRMS!',
  WORK_ANNIVERSARY: '🎉 Happy Work Anniversary - {years} at Eureka HRMS!',
  WORK_ANNIVERSARY_MILESTONE: '🌟 Celebrating {years} Milestone at Eureka HRMS!',
  // Leave Approval Reminders
  LEAVE_APPROVAL_REMINDER: 'Eureka HRMS - Pending Leave Approvals',
  LEAVE_APPROVAL_REMINDER_URGENT: '🚨 URGENT: Eureka HRMS - Leave Auto-Approval in {days} Days',
  LEAVE_APPROVAL_REMINDER_CRITICAL: '⚠️ FINAL REMINDER: Leave Auto-Approval Tomorrow!',
  // Attendance Approval Reminders
  ATTENDANCE_APPROVAL_REMINDER: 'Eureka HRMS - Pending Attendance Approvals',
  ATTENDANCE_APPROVAL_REMINDER_URGENT:
    '🚨 URGENT: Eureka HRMS - Attendance Auto-Approval in {days} Days',
  ATTENDANCE_APPROVAL_REMINDER_CRITICAL: '⚠️ FINAL REMINDER: Attendance Auto-Approval Tomorrow!',
  // Payslip
  PAYSLIP: 'Eureka HRMS - Salary Slip for {monthYear}',
  // FNF Documents
  FNF_DOCUMENTS: 'Exit Documents - {employeeName}',
  // Approval Notifications
  ATTENDANCE_APPROVED: 'Attendance Approved - {date}',
  ATTENDANCE_REJECTED: 'Attendance Rejected - {date}',
  ATTENDANCE_REGULARIZED: 'Attendance Regularized - {date}',
  EXPENSE_APPROVED: 'Expense Approved - {category}',
  EXPENSE_REJECTED: 'Expense Rejected - {category}',
  FUEL_EXPENSE_APPROVED: 'Fuel Expense Approved - {vehicleNo}',
  FUEL_EXPENSE_REJECTED: 'Fuel Expense Rejected - {vehicleNo}',
  LEAVE_APPROVED: 'Leave Approved - {leaveCategory}',
  LEAVE_REJECTED: 'Leave Rejected - {leaveCategory}',
};

export const EMAIL_TEMPLATE = {
  WELCOME_EMPLOYEE: 'welcomeEmployee',
  FORGET_PASSWORD: 'forgetPassword',
  FY_LEAVE_CONFIG_REMINDER: 'fyLeaveConfigReminder',
  VEHICLE_DOCUMENT_EXPIRY: 'vehicleDocumentExpiry',
  VEHICLE_SERVICE_DUE: 'vehicleServiceDue',
  ASSET_CALIBRATION_EXPIRY: 'assetCalibrationExpiry',
  ASSET_WARRANTY_EXPIRY: 'assetWarrantyExpiry',
  CARD_EXPIRY: 'cardExpiry',
  PENDING_EXPENSE_REMINDER: 'pendingExpenseReminder',
  BIRTHDAY_WISH: 'birthdayWish',
  WORK_ANNIVERSARY: 'workAnniversary',
  LEAVE_APPROVAL_REMINDER: 'leaveApprovalReminder',
  ATTENDANCE_APPROVAL_REMINDER: 'attendanceApprovalReminder',
  PAYSLIP: 'payslip',
  FNF_DOCUMENTS: 'fnfDocuments',
  // Approval Notifications
  ATTENDANCE_APPROVAL: 'attendanceApproval',
  ATTENDANCE_REGULARIZATION: 'attendanceRegularization',
  EXPENSE_APPROVAL: 'expenseApproval',
  FUEL_EXPENSE_APPROVAL: 'fuelExpenseApproval',
  LEAVE_APPROVAL: 'leaveApproval',
};

export const EMAIL_REDIRECT_ROUTES = {
  ATTENDANCE: '/attendance',
  EXPENSES: '/expenses',
  FUEL_EXPENSES: '/fuel-expenses',
  LEAVES: '/leaves',
};

export const TEMPLATE_CATEGORY_MAP: Record<string, CommunicationCategory> = {
  attendanceApproval: CommunicationCategory.ATTENDANCE_APPROVAL,
  attendanceRegularization: CommunicationCategory.ATTENDANCE_REGULARIZATION,
  expenseApproval: CommunicationCategory.EXPENSE_APPROVAL,
  fuelExpenseApproval: CommunicationCategory.FUEL_EXPENSE_APPROVAL,
  leaveApproval: CommunicationCategory.LEAVE_APPROVAL,
  leaveApprovalReminder: CommunicationCategory.LEAVE_APPROVAL_REMINDER,
  attendanceApprovalReminder: CommunicationCategory.ATTENDANCE_APPROVAL_REMINDER,
  pendingExpenseReminder: CommunicationCategory.EXPENSE_APPROVAL_REMINDER,
  vehicleDocumentExpiry: CommunicationCategory.VEHICLE_DOCUMENT_EXPIRY,
  assetWarrantyExpiry: CommunicationCategory.ASSET_WARRANTY_EXPIRY,
  assetCalibrationExpiry: CommunicationCategory.ASSET_CALIBRATION_EXPIRY,
  cardExpiry: CommunicationCategory.CARD_EXPIRY,
  vehicleServiceDue: CommunicationCategory.VEHICLE_SERVICE_DUE,
  birthdayWish: CommunicationCategory.BIRTHDAY_WISH,
  workAnniversary: CommunicationCategory.WORK_ANNIVERSARY,
  payslip: CommunicationCategory.PAYSLIP,
  fnfDocuments: CommunicationCategory.FNF_DOCUMENTS,
  forgetPassword: CommunicationCategory.FORGET_PASSWORD,
  fyLeaveConfigReminder: CommunicationCategory.FY_LEAVE_CONFIG_REMINDER,
  welcomeEmployee: CommunicationCategory.WELCOME_EMPLOYEE,
};
