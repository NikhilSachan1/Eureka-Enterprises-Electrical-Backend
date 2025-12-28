import { UserStatus } from '../../users/constants/user.constants';

/**
 * CRON 8
 * Monthly Payroll Generation
 *
 * Get all users eligible for payroll:
 * 1. ACTIVE users with active salary structure
 * 2. ARCHIVED users who have attendance records in the payroll month
 *    (they worked during that period and should get paid)
 */
export const getEligibleUsersForPayrollQuery = (month: number, year: number) => {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
    .toString()
    .padStart(2, '0')}`;

  return {
    query: `
      SELECT DISTINCT 
        u.id as "userId",
        u."firstName",
        u."lastName",
        u."dateOfJoining",
        u.status as "userStatus"
      FROM users u
      INNER JOIN salary_structures ss ON ss."userId" = u.id
      WHERE u."deletedAt" IS NULL
        AND ss."deletedAt" IS NULL
        AND (
          -- Active users with active salary structure
          (u.status = $1 AND ss."isActive" = true)
          OR
          -- Archived users who have attendance in the payroll month
          (u.status = $2 AND EXISTS (
            SELECT 1 FROM attendances a 
            WHERE a."userId" = u.id 
              AND a."attendanceDate" >= $3::date 
              AND a."attendanceDate" <= $4::date
              AND a."deletedAt" IS NULL
          ))
        )
    `,
    params: [UserStatus.ACTIVE, UserStatus.ARCHIVED, startDate, endDate],
  };
};

/**
 * Check if payroll already exists for a user for a specific month/year
 */
export const checkExistingPayrollQuery = (userId: string, month: number, year: number) => {
  return {
    query: `
      SELECT id
      FROM payroll
      WHERE "userId" = $1
        AND month = $2
        AND year = $3
        AND "deletedAt" IS NULL
    `,
    params: [userId, month, year],
  };
};
