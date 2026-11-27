import { EntityManager } from 'typeorm';
import { LeaveLedgerEntryType } from '../constants/leave-ledger.constants';

/** Attendance of one month, as payroll counts it. */
export interface MonthAttendance {
  /** YYYY-MM */
  month: string;
  workingDays: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  /** present + half × 0.5 + paid leave, capped at working days */
  paidDays: number;
  /** annualQuota / 12 × paidDays / workingDays, unrounded */
  earned: number;
}

export interface LeaveLedgerMetadata {
  months?: MonthAttendance[];
  target?: number;
  creditedBefore?: number;
  unrecovered?: number;
  convertedDates?: string[];
  [key: string]: unknown;
}

export interface LedgerEntryInput {
  userId: string;
  leaveCategory: string;
  financialYear: string;
  entryType: LeaveLedgerEntryType;
  days: number;
  periodMonth?: string | null;
  leaveApplicationId?: string | null;
  attendanceId?: string | null;
  reason?: string | null;
  metadata?: LeaveLedgerMetadata | null;
  createdBy?: string | null;
}

export interface LeaveDebitInput {
  userId: string;
  leaveCategory: string;
  financialYear: string;
  leaveApplicationId: string;
  leaveDate: string;
  createdBy: string;
}

export interface HolidayWorkCreditInput {
  userId: string;
  leaveCategory: string;
  financialYear: string;
  /** The month's total holiday-work leave (not the increment). */
  days: number;
  /** e.g. "8 Nov 2026" */
  holidayDates: string;
  /** YYYY-MM-01 */
  periodMonth: string;
  createdBy?: string | null;
}

/** holiday_work_compensation config (payroll module). */
export interface HolidayWorkSettings {
  leaveCategory: string;
  leavePerHoliday: number;
}

export interface HolidayWorkedRow {
  userId: string;
  date: string;
}

export interface LeaveReversalInput {
  leaveApplicationId: string;
  cause: string;
  createdBy: string;
  entityManager: EntityManager;
  /** The day given back (YYYY-MM-DD), for a multi-day application; defaults to its first day. */
  leaveDate?: string;
}

export interface LockedBalance {
  id: string;
  totalAllocated: number;
  consumed: number;
  available: number;
}

export interface AccrualCategory {
  category: string;
  annualQuota: number;
}

export interface AccrualSettings {
  financialYear: string;
  leaveConfigId: string;
  categories: AccrualCategory[];
  /** 1 when fractional leave is off, else 0.5 */
  step: number;
}

export interface WorkingDaysSettings {
  excludeSundays: boolean;
  excludeSaturdays: boolean;
  useHolidayCalendar: boolean;
  defaultWorkingDays: number;
}

export interface LeaveLedgerRequest {
  user: { id: string };
}

export interface MonthCounts {
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
}

/** userId → month (YYYY-MM) → counts */
export type AttendanceCounts = Map<string, Map<string, MonthCounts>>;

export interface AttendanceCountRow extends MonthCounts {
  userId: string;
  month: string;
}

export interface ConvertibleLeaveDay {
  attendanceId: string;
  date: string;
  leaveApplicationId: string;
}

export interface SettlementOutcome {
  posted: number;
  converted: number;
  unrecovered: number;
  availableAfter: number;
}

export interface CachedValue<T> {
  value: T;
  expiresAt: number;
}

export interface AccrualUser {
  id: string;
  dateOfJoining: string | null;
}

export interface SettlementCredit {
  userId: string;
  leaveCategory: string;
  days: number;
  availableAfter: number;
  month: string;
}

export interface MonthlySettlementResult {
  financialYear: string;
  settledThrough: string;
  usersProcessed: number;
  credited: number;
  clawedBack: number;
  convertedToLwp: number;
  unrecovered: number;
  advancesGiven: number;
  /** Leave credited for holidays worked */
  holidayCredited: number;
  /** Employees who received leave, for notifications */
  credits: SettlementCredit[];
  errors: string[];
}

export interface LedgerUserRef {
  id: string;
  firstName: string;
  lastName: string;
}

/** A ledger row as read for the statement (createdAt as 'YYYY-MM-DDTHH:mm:ss'). */
export interface LedgerEntryQueryRow {
  id: string;
  createdAt: string;
  entryType: LeaveLedgerEntryType;
  days: number;
  periodMonth: string | null;
  reason: string | null;
  leaveApplicationId: string | null;
  /** The days applied together share it. */
  applicationGroupId: string | null;
  /** The leave day, for a leave debit / give-back / LWP row. */
  leaveDate: string | null;
  createdBy: LedgerUserRef | null;
}

/** A statement line before the balance: one application's days grouped into one line. */
export interface LedgerEntryRow extends LedgerEntryQueryRow {
  /** Last leave day of the group (same as leaveDate for one day). */
  leaveDateTo: string | null;
  /** Leave days in the line (0 for a credit). */
  dayCount: number;
}

/** One statement line: a credit or a debit, with the balance after it. */
export interface LedgerRecordView {
  id: string;
  date: string;
  entryType: LeaveLedgerEntryType;
  credit: number;
  debit: number;
  days: number;
  balance: number;
  periodMonth: string | null;
  leaveDate: string | null;
  leaveDateTo: string | null;
  dayCount: number;
  /** For a month's credit: that month's working days and days paid (present, half, leave). */
  workingDays: number | null;
  paidDays: number | null;
  reason: string | null;
  createdBy: LedgerUserRef | null;
}

export interface LeaveLedgerView {
  userId: string;
  leaveCategory: string;
  financialYear: string;
  summary: { earned: number; used: number; available: number };
  records: LedgerRecordView[];
  totalRecords: number;
}
