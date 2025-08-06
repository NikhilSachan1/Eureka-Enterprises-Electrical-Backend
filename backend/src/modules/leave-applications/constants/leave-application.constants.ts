export const LEAVE_APPLICATION_ERRORS = {
  NOT_FOUND: 'Leave application not found',
  LEAVE_TYPE_NOT_FOUND:
    'Leave type not found, Please choose from the available leave types: {leaveTypes}',
  LEAVE_CATEGORY_NOT_FOUND:
    'Leave category not found, Please choose from the available leave categories: {leaveCategories}',
  LEAVE_CATEGORY_DOES_NOT_EXIST:
    'Leave category {leaveCategory} does not exist in the configuration',
  CONFIGURATION_NOT_FOUND: 'Configuration not found for leave category {leaveCategory}',
  INVALID_DATE_FORMAT: 'Invalid date format. Expected format: YYYY-MM-DD',
  FROM_DATE_GREATER_THAN_TO_DATE: 'From date cannot be greater than to date',
  INVALID_DATE_RANGE: 'Invalid date range',
  LEAVE_OUTSIDE_FINANCIAL_YEAR:
    'Leave cannot be applied outside the current financial year (April 1st to March 31st)',
  LEAVE_OUTSIDE_CALENDAR_YEAR:
    'Leave cannot be applied outside the current calendar year (January 1st to December 31st)',
  LEAVE_OUTSIDE_CURRENT_CYCLE: 'Leave cannot be applied outside the current leave cycle period',
  INVALID_CYCLE_TYPE: 'Invalid cycle type',
  LEAVE_BALANCE_EXHAUSTED:
    'Leave balance for {leaveCategory} is exhausted. You can apply for only {balance} days',
  HALF_DAY_LEAVE_NOT_ALLOWED: 'Half-day leave is not allowed for {leaveCategory}',
  BACKWARD_LEAVE_NOT_ALLOWED: 'Backward leave application is not allowed for {leaveCategory}',
  MINIMUM_DAYS_BEFORE_APPLYING:
    'Leave application for {leaveCategory} must be submitted at least {applyBeforeDays} days before the leave date',
  MAX_DAYS_EXCEEDED: 'Leave application for {leaveCategory} cannot exceed {maxDays} days',
  EMPLOYEE_CANNOT_SPECIFY_USER_IDS: 'Employee cannot specify user IDs',
  LEAVE_APPLICATION_ALREADY_EXISTS:
    'Leave application already exists for the same leave category, for dates {fromDate} to {toDate}',
  HOLIDAY_VALIDATION_ERROR:
    'Leave cannot be applied on holiday: {date}. Please remove this date from your leave application.',
  LEAVE_APPLICATION_STATUS_SWITCH_ERROR:
    'Leave application is already in {status} state, cannot be processed',
  LEAVE_APPLICATION_ATTENDANCE_STATUS_REQUIRED:
    'Attendance status is required when leave date is current date or earlier',
  LEAVE_APPLICATION_ATTENDANCE_STATUS_NOT_ALLOWED:
    'Attendance status is not allowed when leave date is future date',
  LEAVE_CANCELLATION_NOT_ALLOWED:
    'Leave cancellation is not allowed after leave date is passed or current date, for cancellation contact the Admin or HR',
  LEAVE_REJECTED_CANNOT_BE_APPROVED:
    'Rejected leave application cannot be approved, ask employee to reapply the leave application',
};

export const LEAVE_APPLICATION_FIELD_NAMES = {
  LEAVE_APPLICATION: 'Leave application',
};

export const LEAVE_APPLICATION_SUCCESS_MESSAGES = {
  CREATE: 'Leave application created successfully',
  LEAVE_APPLICATION_APPROVAL_PROCESSED:
    'Leave application approval processed successfully for {length} leave applications. {success} successful, {error} failed',
  LEAVE_APPLICATION_APPROVAL_SUCCESS:
    'Leave application approval processed successfully for {status}',
};

export enum LeaveType {
  FULL_DAY = 'FULL_DAY',
  HALF_DAY = 'HALF_DAY',
}

export enum ApprovalStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

export enum LeaveApplicationType {
  SELF = 'self',
  FORCED = 'forced',
  SYSTEM = 'system',
}

export const LEAVE_APPLICATION_SORTABLE_FIELDS = {
  // Leave Application fields
  createdAt: 'la."createdAt"',
  updatedAt: 'la."updatedAt"',
  fromDate: 'la."fromDate"',
  toDate: 'la."toDate"',
  approvalStatus: 'la."approvalStatus"',
  leaveType: 'la."leaveType"',
  leaveCategory: 'la."leaveCategory"',
  entrySourceType: 'la."entrySourceType"',
  leaveApplicationType: 'la."leaveApplicationType"',
  approvalAt: 'la."approvalAt"',

  // User fields (applicant)
  firstName: 'u."firstName"',
  lastName: 'u."lastName"',
  email: 'u."email"',
  contactNumber: 'u."contactNumber"',

  // Approver fields
  approverFirstName: 'approver."firstName"',
  approverLastName: 'approver."lastName"',
  approverEmail: 'approver."email"',

  // Combined fields
  fullName: 'CONCAT(u."firstName", \' \', u."lastName")',
  approverFullName: 'CONCAT(approver."firstName", \' \', approver."lastName")',
} as const;

export const DEFAULT_APPROVAL_COMMENT = {
  LEAVE_APPLICATION: 'Leave application',
};
