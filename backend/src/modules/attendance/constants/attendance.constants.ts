export enum EntrySourceType {
  WEB = 'web',
  APP = 'app',
  BIOMETRIC = 'biometric',
}

export enum AttendanceType {
  SELF = 'self',
  REGULARIZED = 'regularized',
  FORCED = 'forced',
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

export const ATTENDANCE_ERRORS = {
  NOT_FOUND: 'Attendance record not found',
  ALREADY_CHECKED_IN: 'Already checked in for today',
  NOT_CHECKED_IN: 'Not checked in yet',
  ALREADY_CHECKED_OUT: 'Already checked out',
  INVALID_ACTION: 'Invalid attendance action',
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
};

export const ATTENDANCE_RESPONSES = {
  CHECK_IN_SUCCESS: 'Successfully checked in',
  CHECK_OUT_SUCCESS: 'Successfully checked out',
  ATTENDANCE_UPDATED: 'Attendance record updated successfully',
  ATTENDANCE_REGULARIZED: 'Attendance regularized successfully',
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
