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
  coveredThrough?: string;
  target?: number;
  creditedBefore?: number;
  unrecovered?: number;
  convertedDates?: string[];
  legacyNotes?: string | null;
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

export interface RecalculationCandidateRow {
  userId: string;
  leaveCategory: string;
  legacyOpening: number | null;
  legacyCorrection: number | null;
  corrections: number;
  coveredThrough: string | null;
  firstName: string;
  lastName: string;
  employeeId: string | null;
  dateOfJoining: string | null;
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
  /** Employees who received leave, for notifications */
  credits: SettlementCredit[];
  errors: string[];
}

export interface RecalculationRow {
  userId: string;
  employeeName: string;
  employeeCode: string | null;
  dateOfJoining: string | null;
  leaveCategory: string;
  oldCredit: number;
  correctCredit: number;
  difference: number;
  consumed: number;
  availableNow: number;
  /** what apply will post: difference, limited so the balance stays at 0 or above */
  adjustment: number;
  availableAfter: number;
  /** leave already used beyond what attendance earned; HR decides these by hand */
  excessUsed: number;
  months: MonthAttendance[];
  applied: boolean;
}

export interface RecalculationReport {
  financialYear: string;
  coveredThrough: string;
  canApply: boolean;
  rows: RecalculationRow[];
}

export interface LedgerEntryView {
  id: string;
  createdAt: Date;
  entryType: LeaveLedgerEntryType;
  days: number;
  balanceAfter: number;
  periodMonth: string | null;
  reason: string | null;
  leaveApplicationId: string | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
}

export interface LeaveLedgerView {
  userId: string;
  leaveCategory: string;
  financialYear: string;
  summary: { credited: number; used: number; available: number };
  months: Array<MonthAttendance & { credited: number }>;
  entries: LedgerEntryView[];
}
