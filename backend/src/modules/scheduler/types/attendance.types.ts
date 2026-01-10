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

/**
 * CRON 21
 * Auto Approve Pending Attendance
 * Runs on 1st of every month at 12:00 AM IST (before payroll generation)
 *
 * Auto-approves all pending attendance records for the previous month
 * This ensures attendance is counted in payroll even if admin forgot to approve
 *
 * Statuses eligible for auto-approval (when approvalStatus = PENDING):
 * - ABSENT: Employee was marked absent
 * - CHECKED_OUT: Normal attendance with check-in/out
 * - HALF_DAY: Half day attendance
 * - LEAVE: Leave attendance (approval mirrors leave approval)
 * - LEAVE_WITHOUT_PAY: LWP attendance
 */
export interface AutoApproveAttendanceResult {
  attendanceApproved: number;
  byStatus: {
    absent: number;
    checkedOut: number;
    halfDay: number;
    leave: number;
    leaveWithoutPay: number;
    approvalPending: number;
    other: number;
  };
  errors: string[];
}

/**
 * CRON 22
 * Attendance Approval Reminder
 * Runs daily from 25th to end of month at 9:00 AM IST
 *
 * Sends reminder emails to HR/Admin about pending attendance approvals
 * that will be auto-approved on the 1st of next month if not actioned.
 */
export interface AttendanceApprovalReminderResult {
  emailsSent: number;
  totalPendingAttendance: number;
  recipients: string[];
  errors: string[];
}

export interface PendingAttendanceAlert {
  id: string;
  attendanceDate: Date;
  userId: string;
  employeeName: string;
  status: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  notes: string | null;
}

export interface AttendanceStatusSummary {
  status: string;
  count: number;
  displayName: string;
}

export interface AttendanceApprovalEmailItem {
  employeeName: string;
  attendanceDate: string;
  status: string;
  statusDisplayName: string;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
  statusClass: 'urgent' | 'pending';
}

export interface AttendanceApprovalEmailData {
  totalPending: number;
  totalUrgent: number;
  daysUntilAutoApproval: number;
  urgencyLevel: 'critical' | 'urgent' | 'normal';
  statusSummaries: AttendanceStatusSummary[];
  urgentAttendance: AttendanceApprovalEmailItem[];
  pendingAttendance: AttendanceApprovalEmailItem[];
  hasUrgent: boolean;
  hasPending: boolean;
  autoApprovalDate: string;
  monthName: string;
  adminPortalUrl: string;
  currentYear: number;
}
