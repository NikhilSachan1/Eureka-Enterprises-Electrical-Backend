export enum LeaveLedgerEntryType {
  /** Credited in advance on 1 April, or in the joining month. Settled at month end. */
  ADVANCE_CREDIT = 'advance_credit',
  /** What a month earned from attendance, minus what was already credited for it. */
  MONTHLY_ACCRUAL = 'monthly_accrual',
  HOLIDAY_WORK_CREDIT = 'holiday_work_credit',
  LEAVE_DEBIT = 'leave_debit',
  /** A debited leave day given back (rejected, cancelled, regularized, deleted). */
  LEAVE_REVERSAL = 'leave_reversal',
  /** A paid leave day turned into LWP at settlement so the balance never goes below 0. */
  LWP_CONVERSION = 'lwp_conversion',
}

/** Entries that add to totalAllocated (credits, negative or positive). */
export const ALLOCATION_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.ADVANCE_CREDIT,
  LeaveLedgerEntryType.MONTHLY_ACCRUAL,
  LeaveLedgerEntryType.HOLIDAY_WORK_CREDIT,
];

/** Entries that move consumed (stored negative for a debit, positive for a give-back). */
export const CONSUMPTION_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.LEAVE_DEBIT,
  LeaveLedgerEntryType.LEAVE_REVERSAL,
  LeaveLedgerEntryType.LWP_CONVERSION,
];

/** Rows about individual leave days, grouped per application in the statement. */
export const LEAVE_DAY_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.LEAVE_DEBIT,
  LeaveLedgerEntryType.LEAVE_REVERSAL,
  LeaveLedgerEntryType.LWP_CONVERSION,
];

/** Credits that the month-end settlement measures against attendance. */
export const SETTLED_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.ADVANCE_CREDIT,
  LeaveLedgerEntryType.MONTHLY_ACCRUAL,
];

export const LEAVE_LEDGER_PERMISSIONS = {
  VIEW_ALL: 'leave.ledger.view-all',
} as const;

export const LEAVE_LEDGER_ERRORS = {
  INSUFFICIENT_BALANCE:
    'Insufficient {leaveCategory} leave balance. Available: {available} day(s), needed: {days}',
  CONFIG_NOT_FOUND: 'Leave categories config not found for FY {financialYear}',
  CANNOT_VIEW_OTHERS: 'You can only view your own leave ledger',
};

export const LEAVE_LEDGER_REASONS = {
  ADVANCE_APRIL: 'Advance for {month} (settled from attendance at month end)',
  ADVANCE_JOINING: 'Joining-month advance for {month}, from {fromDate} (settled at month end)',
  ACCRUAL: 'Earned from attendance for {month}',
  ACCRUAL_CLAWBACK: 'Settled against attendance for {month} (worked less than credited)',
  LEAVE_DEBIT: 'Leave on {date}',
  LEAVE_REVERSAL: 'Leave on {date} given back ({cause})',
  LWP_CONVERSION: 'Leave on {date} turned into LWP: not enough leave earned through {month}',
  HOLIDAY_WORK: 'Worked on holiday ({dates})',
} as const;

export const LEAVE_REVERSAL_CAUSES = {
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REGULARIZED_PRESENT: 'regularized to present',
  REGULARIZED_ABSENT: 'regularized to absent',
  REGULARIZED_HOLIDAY: 'regularized to holiday',
  FORCE_ATTENDANCE: 'force attendance applied',
  ATTENDANCE_DELETED: 'attendance deleted',
} as const;

export const LWP_ATTENDANCE_COMMENT =
  'Turned into LWP at month-end leave settlement (not enough leave earned)';

/** First month of the financial year (April, 1-based). */
export const FY_START_MONTH = 4;

export const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const POSTGRES_UNIQUE_VIOLATION = '23505';

export const IST_TIMEZONE = 'Asia/Kolkata';

/** holiday_work_compensation.type that pays a worked holiday in leave (else it is money). */
export const HOLIDAY_WORK_LEAVE_TYPE = 'LEAVE';
export const DEFAULT_HOLIDAY_WORK_CATEGORY = 'earned';

/** Config reads are cached this long within a run (settlement reads them per employee). */
export const ACCRUAL_CONFIG_CACHE_MS = 60_000;

export const DEFAULT_WORKING_DAYS_SETTINGS = {
  excludeSundays: true,
  excludeSaturdays: false,
  useHolidayCalendar: true,
  defaultWorkingDays: 26,
} as const;
