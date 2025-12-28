import { ApprovalStatus as LeaveApprovalStatus } from '../../leave-applications/constants/leave-application.constants';
import { AttendanceStatus } from '../../attendance/constants/attendance.constants';

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
export const getActiveUsersForAttendanceQuery = (status: string, todayDate: Date) => {
  return {
    query: `
      SELECT id, "dateOfJoining"
      FROM "users"
      WHERE "status" = $1
        AND "deletedAt" IS NULL
        AND ("dateOfJoining" IS NULL OR "dateOfJoining" <= $2)
    `,
    params: [status, todayDate],
  };
};

export const getUserLeavesForDateQuery = (userIds: string[], date: Date) => {
  return {
    query: `
      SELECT "userId", "leaveCategory", "approvalStatus"
      FROM leave_applications
      WHERE "userId" = ANY($1)
        AND "fromDate" <= $2
        AND "toDate" >= $2
        AND "approvalStatus" IN ($3, $4)
        AND "deletedAt" IS NULL
    `,
    params: [userIds, date, LeaveApprovalStatus.APPROVED, LeaveApprovalStatus.PENDING],
  };
};

export const getExistingAttendanceUserIdsQuery = (date: Date) => {
  return {
    query: `
      SELECT "userId"
      FROM attendances
      WHERE "attendanceDate" = $1
        AND "deletedAt" IS NULL
    `,
    params: [date],
  };
};

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
export const getCheckedInAttendancesQuery = (date: Date) => {
  return {
    query: `
      SELECT id, "userId", "checkInTime", "shiftConfigId", "approvalStatus", "notes"
      FROM attendances
      WHERE "attendanceDate" = $1
        AND "status" = $2
        AND "isActive" = true
        AND "deletedAt" IS NULL
    `,
    params: [date, AttendanceStatus.CHECKED_IN],
  };
};

export const getNotCheckedInAttendancesQuery = (date: Date) => {
  return {
    query: `
      SELECT id, "userId", "notes"
      FROM attendances
      WHERE "attendanceDate" = $1
        AND "status" = $2
        AND "isActive" = true
        AND "deletedAt" IS NULL
    `,
    params: [date, AttendanceStatus.NOT_CHECKED_IN_YET],
  };
};

/**
 * Get users who don't have any attendance record for today
 * (Users added after morning cron ran)
 */
export const getUsersWithoutAttendanceQuery = (status: string, date: Date) => {
  return {
    query: `
      SELECT u.id
      FROM "users" u
      WHERE u."status" = $1
        AND u."deletedAt" IS NULL
        AND (u."dateOfJoining" IS NULL OR u."dateOfJoining" <= $2)
        AND NOT EXISTS (
          SELECT 1 FROM attendances a
          WHERE a."userId" = u.id
            AND a."attendanceDate" = $2
            AND a."deletedAt" IS NULL
        )
    `,
    params: [status, date],
  };
};
