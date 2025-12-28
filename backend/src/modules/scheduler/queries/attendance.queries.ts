import { ApprovalStatus as LeaveApprovalStatus } from '../../leave-applications/constants/leave-application.constants';

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
