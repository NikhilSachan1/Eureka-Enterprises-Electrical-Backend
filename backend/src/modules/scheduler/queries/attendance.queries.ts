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

/**
 * CRON 21
 * Auto Approve Pending Attendance
 * Get all pending attendance records for a date range (previous month)
 */
import { ApprovalStatus } from '../../attendance/constants/attendance.constants';

export const getPendingAttendancesForPeriodQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT id, "userId", "status"
      FROM attendances
      WHERE "approvalStatus" = $1
        AND "attendanceDate" >= $2::date
        AND "attendanceDate" <= $3::date
        AND "deletedAt" IS NULL
        AND "isActive" = true
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

/**
 * CRON 22
 * Attendance Approval Reminder
 * Get pending attendance with employee details for the current month
 */
export const getPendingAttendanceForCurrentMonthQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT 
        a.id,
        a."attendanceDate",
        a."userId",
        CONCAT(u."firstName", ' ', u."lastName") as "employeeName",
        a."status",
        a."checkInTime",
        a."checkOutTime",
        a."notes"
      FROM attendances a
      INNER JOIN users u ON u.id = a."userId" AND u."deletedAt" IS NULL
      WHERE a."approvalStatus" = $1
        AND a."attendanceDate" >= $2::date
        AND a."attendanceDate" <= $3::date
        AND a."deletedAt" IS NULL
        AND a."isActive" = true
      ORDER BY a."attendanceDate" DESC, u."firstName" ASC
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

export const getPendingAttendanceByStatusQuery = (startDate: string, endDate: string) => {
  return {
    query: `
      SELECT 
        a."status",
        COUNT(*)::integer as "count"
      FROM attendances a
      WHERE a."approvalStatus" = $1
        AND a."attendanceDate" >= $2::date
        AND a."attendanceDate" <= $3::date
        AND a."deletedAt" IS NULL
        AND a."isActive" = true
      GROUP BY a."status"
      ORDER BY COUNT(*) DESC
    `,
    params: [ApprovalStatus.PENDING, startDate, endDate],
  };
};

export const ATTENDANCE_URGENT_THRESHOLD_DAYS = 20;

/**
 * CRON 21
 * Auto-approve attendance with conditional status change:
 * - CHECKED_OUT, HALF_DAY → PRESENT (work done, approval confirms it)
 * - ABSENT, LEAVE, LEAVE_WITHOUT_PAY → Keep original status (just approve)
 */
export const autoApproveAttendanceQuery = (
  attendanceId: string,
  currentStatus: string,
  approvalReason: string,
  systemUserId: string,
) => {
  // Only change to PRESENT if it was a working day attendance
  const shouldChangeToPRESENT =
    currentStatus === AttendanceStatus.CHECKED_OUT || currentStatus === AttendanceStatus.HALF_DAY;

  if (shouldChangeToPRESENT) {
    return {
      query: `
        UPDATE attendances 
        SET "approvalStatus" = $1, 
            "status" = $2,
            "approvalAt" = $3, 
            "approvalComment" = $4,
            "approvalBy" = $5,
            "updatedBy" = $5,
            "updatedAt" = $3
        WHERE id = $6
      `,
      params: [
        ApprovalStatus.APPROVED,
        AttendanceStatus.PRESENT,
        new Date(),
        approvalReason,
        systemUserId,
        attendanceId,
      ],
    };
  }

  // For ABSENT, LEAVE, LEAVE_WITHOUT_PAY - just update approval status, keep original status
  return {
    query: `
      UPDATE attendances 
      SET "approvalStatus" = $1, 
          "approvalAt" = $2, 
          "approvalComment" = $3,
          "approvalBy" = $4,
          "updatedBy" = $4,
          "updatedAt" = $2
      WHERE id = $5
    `,
    params: [ApprovalStatus.APPROVED, new Date(), approvalReason, systemUserId, attendanceId],
  };
};
