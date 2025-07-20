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
    'Leave balance for {leaveCategory} is exhausted. You can apply for only {numberOfDays} days',
  HALF_DAY_LEAVE_NOT_ALLOWED: 'Half-day leave is not allowed for {leaveCategory}',
  BACKWARD_LEAVE_NOT_ALLOWED: 'Backward leave application is not allowed for {leaveCategory}',
  MINIMUM_DAYS_BEFORE_APPLYING:
    'Leave application for {leaveCategory} must be submitted at least {applyBeforeDays} days before the leave date',
  MAX_DAYS_EXCEEDED: 'Leave application for {leaveCategory} cannot exceed {maxDays} days',
};

export const LEAVE_APPLICATION_FIELD_NAMES = {
  LEAVE_APPLICATION: 'Leave application',
};

export const LEAVE_APPLICATION_SUCCESS_MESSAGES = {
  CREATE: 'Leave application created successfully',
};

export enum LeaveType {
  FULL_DAY = 'FULL_DAY',
  HALF_DAY = 'HALF_DAY',
}

export enum ApprovalStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
}

export enum LeaveApplicationType {
  SELF = 'self',
  FORCED = 'forced',
  SYSTEM = 'system',
}
