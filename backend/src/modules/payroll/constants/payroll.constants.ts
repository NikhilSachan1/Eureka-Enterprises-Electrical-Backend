export enum PayrollStatus {
  DRAFT = 'DRAFT',
  GENERATED = 'GENERATED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export const PAYROLL_ERRORS = {
  NOT_FOUND: 'Payroll record not found',
  USER_NOT_FOUND: 'User not found',
  NO_SALARY_STRUCTURE: 'No salary structure found for this user',
  ALREADY_EXISTS: 'Payroll for this month/year already exists for this user',
  ALREADY_APPROVED: 'Payroll has already been approved',
  ALREADY_PAID: 'Payroll has already been paid',
  ALREADY_CANCELLED: 'Payroll has been cancelled',
  CANNOT_MODIFY_APPROVED: 'Cannot modify approved payroll',
  CANNOT_MODIFY_PAID: 'Cannot modify paid payroll',
  INVALID_MONTH: 'Month must be between 1 and 12',
  INVALID_YEAR: 'Invalid year',
  FUTURE_PAYROLL: 'Cannot generate payroll for future months',
  MUST_BE_APPROVED_BEFORE_PAID: 'Payroll must be approved before marking as paid',
  INVALID_STATUS_TRANSITION: 'Invalid status transition',
  WORKING_DAYS_CONFIG_NOT_FOUND: 'Working days calculation configuration not found',
  WORKING_DAYS_CONFIG_SETTING_NOT_FOUND: 'Working days calculation config setting not found',
  USER_EXITING_USE_FNF:
    'Employee is exiting this month (last working date: {lastWorkingDate}). Please use FNF settlement instead of regular payroll.',
};

export const PAYROLL_RESPONSES = {
  GENERATED: 'Payroll generated successfully',
  APPROVED: 'Payroll approved successfully',
  PAID: 'Payroll marked as paid',
  CANCELLED: 'Payroll cancelled successfully',
  UPDATED: 'Payroll updated successfully',
  DELETED: 'Payroll deleted successfully',
  BULK_GENERATED: 'Bulk payroll generation completed. Success: {success}, Failed: {failed}',
};

export const PAYROLL_FIELD_NAMES = {
  PAYROLL: 'Payroll',
};

export const PAYROLL_SORT_FIELD_MAPPING: Record<string, string> = {
  month: 'p."month"',
  year: 'p."year"',
  grossEarnings: 'p."grossEarnings"',
  netPayable: 'p."netPayable"',
  status: 'p."status"',
  createdAt: 'p."createdAt"',
  updatedAt: 'p."updatedAt"',
};

export const PAYROLL_DTO_ERRORS = {
  INVALID_PAYROLL_STATUS: 'Invalid payroll status. Please choose from: {payrollStatuses}',
};

export const HOLIDAY_WORK_CREDIT = {
  SOURCE: 'holiday_work',
  NOTE_TEMPLATE:
    'Credited {leavesToCredit} Earned Leave(s) for working on holidays ({holidayDates}) during payroll {monthYear}',
  LOG_SUCCESS: 'Credited {leavesToCredit} earned leaves to user {userId} for holiday work',
  LOG_ERROR: 'Failed to credit holiday work leaves for user {userId}',
  LOG_CONFIG_NOT_FOUND:
    'Leave config not found for FY {financialYear}, skipping holiday leave credit',
};

export enum HolidayWorkCompensationType {
  MONEY = 'MONEY',
  LEAVE = 'LEAVE',
}
