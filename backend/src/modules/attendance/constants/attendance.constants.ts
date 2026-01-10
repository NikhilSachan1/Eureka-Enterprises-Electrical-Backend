export enum AttendanceType {
  SELF = 'self',
  REGULARIZED = 'regularized',
  FORCED = 'forced',
  SYSTEM = 'system',
}

export enum AttendanceAction {
  CHECK_IN = 'checkIn',
  CHECK_OUT = 'checkOut',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  HALF_DAY = 'halfDay',
  LEAVE = 'leave',
  LEAVE_WITHOUT_PAY = 'leaveWithoutPay',
  CHECKED_IN = 'checkedIn',
  CHECKED_OUT = 'checkedOut',
  NOT_CHECKED_IN_YET = 'notCheckedInYet',
  APPROVAL_PENDING = 'approvalPending',
  HOLIDAY = 'holiday',
}

export enum ApprovalStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
}

export enum ShiftStatus {
  BEFORE_SHIFT = 'BEFORE_SHIFT',
  DURING_SHIFT = 'DURING_SHIFT',
  AFTER_SHIFT = 'AFTER_SHIFT',
}

export const ATTENDANCE_ERRORS = {
  NOT_FOUND: 'Attendance record not found',
  ALREADY_CHECKED_IN: 'Already checked in for today',
  NOT_CHECKED_IN: 'Not checked in yet',
  ALREADY_CHECKED_OUT: 'Already checked out',
  INVALID_ACTION: 'Invalid attendance action',
  CHECK_IN_NOT_ALLOWED_ON_LEAVE: 'Check-in is not allowed on leave days.',
  SAME_DAY_REQUIRED: 'Check-in and check-out must be on the same day',
  SHIFT_TIMINGS_NOT_FOUND: 'Shift timings not found',
  INVALID_SHIFT_TIMING: 'Check-in and check-out allowed only between {start} and {end}',
  ATTENDANCE_REJECTED: 'Attendance has been rejected. Please contact admin.',
  MUST_CHECK_OUT_FIRST: 'Already checked in. Please check out first.',
  MANUAL_CHECK_OUT_NOT_ALLOWED: 'Manual check out is not allowed for your organization',
  REGULARIZATION_NOT_ALLOWED: 'Regularization is not allowed for your organization',
  INVALID_TIME: '{timeType} time must be between {start} and {end} (local time)',
  INVALID_CHECK_OUT_TIME: 'Check-out time must be after check-in time',
  INVALID_STATUS: 'Invalid attendance status',
  HOLIDAY_NOT_ALLOWED_AS_ABSENT_REGULARIZE: 'Holiday is not allowed to be regularized as absent',
  HOLIDAY_NOT_ALLOWED_AS_LEAVE_REGULARIZE: 'Holiday is not allowed to be regularized as leave',
  REGULARIZATION_NOT_ALLOWED_DURING_SHIFT: 'Regularization is not allowed during shift hours',
  FUTURE_DATE_REGULARIZATION_NOT_ALLOWED: 'Regularization is not allowed for future dates',
  ALREADY_REGULARIZED: 'Attendance is already regularized and status is {status}',
  FORCE_ATTENDANCE_SAME_DAY_SHIFT_NOT_OVER:
    'Force attendance for same day is only allowed before shift end time',
  FORCE_ATTENDANCE_INVALID_TIME_FORMAT: 'Invalid time format. Use HH:MM format',
  FORCE_ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN: 'Check-out time cannot be before check-in time',
  FORCE_ATTENDANCE_FUTURE_DATE_NOT_ALLOWED: 'Force attendance is not allowed for future dates',
  FORCE_ATTENDANCE_ALREADY_EXISTS:
    'Employee already has attendance record for this date. Please use regularization instead.',
  FORCE_ATTENDANCE_PERMISSION_DENIED:
    'You do not have permission to force attendance for this user',
  FORCE_ATTENDANCE_BEFORE_SHIFT_NOT_ALLOWED: 'Force attendance is not allowed before shift starts',
  FORCE_ATTENDANCE_DURING_SHIFT_ONLY_CHECKIN:
    'Only check-in is allowed for same day force attendance during shift',
  FORCE_ATTENDANCE_AFTER_SHIFT_BOTH_REQUIRED:
    'Both check-in and check-out times are required for same day force attendance after shift ends',
  FORCE_ATTENDANCE_CHECK_IN_TIME_REQUIRED:
    'Check-in time is required for same day force attendance',
  FORCE_ATTENDANCE_BOTH_CHECK_IN_AND_CHECK_OUT_REQUIRED:
    'Both check-in and check-out times are required for same day force attendance',
  FORCE_ATTENDANCE_INVALID_STATUS: 'Unable to determine shift status',
  EMPLOYEE_CANNOT_SPECIFY_USER_IDS: 'userIds should not exist for employee role',
  USER_ID_REQUIRED: 'userId is required for admin, manager and hr role',
  ATTENDANCE_APPROVAL_ALREADY_PROCESSED:
    'Attendance approval is already processed and has {status} status',
};

export const ATTENDANCE_RESPONSES = {
  CHECK_IN_SUCCESS: 'Successfully checked in',
  CHECK_OUT_SUCCESS: 'Successfully checked out',
  ATTENDANCE_UPDATED: 'Attendance record updated successfully',
  ATTENDANCE_REGULARIZED: 'Attendance regularized successfully',
  FORCE_ATTENDANCE_SUCCESS: 'Force attendance applied successfully',
  ATTENDANCE_APPROVAL_SUCCESS: 'Attendance has been {status} successfully',
  ATTENDANCE_APPROVAL_PROCESSED:
    'Processed {length} attendance records with {success} success and {error} errors',
};

export const ATTENDANCE_EMAIL_CONSTANTS = {
  SYSTEM_USER: 'System',
  NOT_APPLICABLE: 'N/A',
};

export const DEFAULT_APPROVAL_COMMENT = {
  PRESENT: 'Regularized as present',
  ABSENT: 'Regularized as absent',
  LEAVE: 'Regularized as leave',
  LEAVE_WITHOUT_PAY: 'Regularized as leave without pay',
  CHECKED_IN: 'Regularized as checked in',
  CHECKED_OUT: 'Regularized as checked out',
  NOT_CHECKED_IN_YET: 'Regularized as not checked in yet',
  APPROVAL_PENDING: 'Regularized as approval pending',
  HOLIDAY: 'Regularized as holiday',
  FORCED: 'Force attendance',
};

export enum AttendanceEntityFields {
  ID = 'id',
  USER_ID = 'userId',
  ATTENDANCE_DATE = 'attendanceDate',
  CHECK_IN_TIME = 'checkInTime',
  CHECK_OUT_TIME = 'checkOutTime',
  STATUS = 'status',
  CONFIG_SETTING_ID = 'configSettingId',
  ENTRY_SOURCE_TYPE = 'entrySourceType',
  ATTENDANCE_TYPE = 'attendanceType',
  REGULARIZED_BY = 'regularizedBy',
  APPROVAL_STATUS = 'approvalStatus',
  APPROVAL_BY = 'approvalBy',
  APPROVAL_AT = 'approvalAt',
  APPROVAL_COMMENT = 'approvalComment',
  NOTES = 'notes',
  IS_ACTIVE = 'isActive',
}

export const ATTENDANCE_SORTABLE_FIELDS = {
  ATTENDANCE_DATE: 'a."attendanceDate"',
  CHECK_IN_TIME: 'a."checkInTime"',
  CHECK_OUT_TIME: 'a."checkOutTime"',
  STATUS: 'a."status"',
  CREATED_AT: 'a."createdAt"',
  UPDATED_AT: 'a."updatedAt"',
  USER_NAME: 'u."firstName"',
};

// Food expense constants for attendance-based crediting
export const FOOD_EXPENSE_CONSTANTS = {
  CATEGORY: 'Food',
  REFERENCE_TYPE: 'ATTENDANCE_FOOD_ALLOWANCE',
  DESCRIPTION: 'Food allowance for attendance on {date}',
  REVERSAL_DESCRIPTION: 'Reversal: Food allowance for {date} (attendance rejected)',
  REFERENCE_ID: 'ATT_FOOD_{userId}_{date}',
  REVERSAL_REFERENCE_ID: 'ATT_FOOD_REV_{userId}_{date}',
};

export const LEAVE_REGULARIZATION_CONSTANTS = {
  LEAVE_CANCELLED_REASON_PRESENT: 'Leave cancelled - Attendance regularized as present on {date}',
  LEAVE_CANCELLED_REASON_ABSENT: 'Leave cancelled - Attendance regularized as absent on {date}',
  REGULARIZATION_NOTES_PRESENT: 'Regularized from leave to present on {date}',
  REGULARIZATION_NOTES_ABSENT: 'Regularized from leave to absent on {date}',
  FORCE_LEAVE_NOTES: 'Regularized to leave on {date}',
  FORCE_LEAVE_REASON: 'Forced leave applied via attendance regularization on {date}',
};
