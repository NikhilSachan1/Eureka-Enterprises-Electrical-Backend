export enum LeaveLedgerEntryType {
  /** Credited in advance on 1 April, or in the joining month. Settled at month end. */
  ADVANCE_CREDIT = 'advance_credit',
  /** Month-end settlement: what the finished month(s) earned from attendance, minus what was credited. */
  MONTHLY_ACCRUAL = 'monthly_accrual',
  HOLIDAY_WORK_CREDIT = 'holiday_work_credit',
  LEAVE_DEBIT = 'leave_debit',
  /** A debited leave day given back (rejected, cancelled, regularized, deleted). */
  LEAVE_REVERSAL = 'leave_reversal',
  /** A paid leave day turned into LWP at settlement so the balance never goes below 0. */
  LWP_CONVERSION = 'lwp_conversion',
  LEGACY_OPENING = 'legacy_opening',
  LEGACY_CONSUMED = 'legacy_consumed',
  /** Approved correction of the legacy opening against attendance. */
  LEGACY_CORRECTION = 'legacy_correction',
}

/** Entries that add to totalAllocated (credits, negative or positive). */
export const ALLOCATION_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.ADVANCE_CREDIT,
  LeaveLedgerEntryType.MONTHLY_ACCRUAL,
  LeaveLedgerEntryType.HOLIDAY_WORK_CREDIT,
  LeaveLedgerEntryType.LEGACY_OPENING,
  LeaveLedgerEntryType.LEGACY_CORRECTION,
];

/** Entries that move consumed (stored negative for a debit, positive for a give-back). */
export const CONSUMPTION_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.LEAVE_DEBIT,
  LeaveLedgerEntryType.LEAVE_REVERSAL,
  LeaveLedgerEntryType.LWP_CONVERSION,
  LeaveLedgerEntryType.LEGACY_CONSUMED,
];

/** Credits that the month-end settlement measures against attendance. */
export const SETTLED_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.ADVANCE_CREDIT,
  LeaveLedgerEntryType.MONTHLY_ACCRUAL,
];

/** The old system's credit, measured only by the reviewed recalculation. */
export const LEGACY_ENTRY_TYPES: readonly LeaveLedgerEntryType[] = [
  LeaveLedgerEntryType.LEGACY_OPENING,
  LeaveLedgerEntryType.LEGACY_CORRECTION,
];

export const LEAVE_LEDGER_PERMISSIONS = {
  VIEW_ALL: 'leave.ledger.view-all',
  RECALCULATE: 'leave.credit.recalculate',
} as const;

export const LEAVE_LEDGER_ERRORS = {
  INSUFFICIENT_BALANCE:
    'Insufficient {leaveCategory} leave balance. Available: {available} day(s), needed: {days}',
  CONFIG_NOT_FOUND: 'Leave categories config not found for FY {financialYear}',
  CANNOT_VIEW_OTHERS: 'You can only view your own leave ledger',
  NO_LEGACY: 'No legacy balance to recalculate for FY {financialYear}',
  MONTH_NOT_FINISHED:
    'The old credit covers {month}, which has not finished yet. Apply after the month ends.',
};

export const LEAVE_LEDGER_REASONS = {
  ADVANCE_APRIL: 'Advance for {month} (settled from attendance at month end)',
  ADVANCE_JOINING: 'Joining-month advance for {month}, from {fromDate} (settled at month end)',
  ACCRUAL: 'Earned from attendance through {month}',
  ACCRUAL_CLAWBACK: 'Settled against attendance through {month} (worked less than credited)',
  LEAVE_DEBIT: 'Leave on {date}',
  LEAVE_REVERSAL: 'Leave on {date} given back ({cause})',
  LWP_CONVERSION: 'Leave on {date} turned into LWP: not enough leave earned through {month}',
  HOLIDAY_WORK: 'Worked on holiday ({dates})',
  LEGACY_CORRECTION:
    'Old credit corrected to attendance through {month}: {from} -> {to} (approved by HR)',
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

/** Config reads are cached this long within a run (settlement reads them per employee). */
export const ACCRUAL_CONFIG_CACHE_MS = 60_000;

export const DEFAULT_WORKING_DAYS_SETTINGS = {
  excludeSundays: true,
  excludeSaturdays: false,
  useHolidayCalendar: true,
  defaultWorkingDays: 26,
} as const;
