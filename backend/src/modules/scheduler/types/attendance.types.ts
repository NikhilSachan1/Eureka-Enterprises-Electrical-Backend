/**
 * CRON 1
 * Daily Attendance Entry Creation
 * Runs at 12:00 AM IST (6:30 PM UTC previous day)
 *
 * Creates attendance records for all active employees:
 * - HOLIDAY: If today is a holiday
 * - LEAVE: If user has approved/pending paid leave
 * - LEAVE_WITHOUT_PAY: If user has approved/pending LWP
 * - NOT_CHECKED_IN_YET: Default for all other users
 */
export interface DailyAttendanceResult {
  totalUsers: number;
  created: number;
  skipped: number;
  holidays: number;
  leaves: number;
  lwp: number;
  errors: string[];
}

/**
 * CRON 2
 * End of Day Attendance Finalization
 * Runs at 7:00 PM IST (1:30 PM UTC) - after typical shift end
 *
 * Actions:
 * 1. Auto-checkout users who forgot to checkout (CHECKED_IN → CHECKED_OUT)
 * 2. Mark absent users who never checked in (NOT_CHECKED_IN_YET → ABSENT)
 * 3. Create ABSENT records for users added after morning cron
 */
export interface EndOfDayAttendanceResult {
  autoCheckouts: number;
  markedAbsent: number;
  newAbsentRecords: number;
  errors: string[];
}
