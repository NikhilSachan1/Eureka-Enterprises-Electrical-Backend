import { AttendanceStatus } from 'src/modules/attendance/constants/attendance.constants';

export const buildPayrollSummaryQuery = (month: number, year: number) => {
  const query = `
    SELECT 
      COUNT(*) as "totalEmployees",
      COALESCE(SUM(p."grossEarnings"), 0) as "totalGrossEarnings",
      COALESCE(SUM(p."totalDeductions"), 0) as "totalDeductions",
      COALESCE(SUM(p."netPayable"), 0) as "totalNetPayable",
      COALESCE(SUM(p."totalBonus"), 0) as "totalBonus",
      COUNT(CASE WHEN p."status" = 'GENERATED' THEN 1 END) as "generatedCount",
      COUNT(CASE WHEN p."status" = 'APPROVED' THEN 1 END) as "approvedCount",
      COUNT(CASE WHEN p."status" = 'PAID' THEN 1 END) as "paidCount",
      COUNT(CASE WHEN p."status" = 'CANCELLED' THEN 1 END) as "cancelledCount"
    FROM "payroll" p
    WHERE p."month" = $1
      AND p."year" = $2
  `;

  return { query, params: [month, year] };
};

export const buildActiveUsersWithSalaryQuery = (status: string, month?: number, year?: number) => {
  // Base query to get active users with salary structures
  let query = `
    SELECT DISTINCT u.id as "userId"
    FROM users u
    INNER JOIN salary_structures ss ON ss."userId" = u.id
    WHERE u.status = $1
      AND u."deletedAt" IS NULL
      AND ss."isActive" = true
  `;

  const params: (string | number)[] = [status];

  // Exclude users whose lastWorkingDate falls within the payroll month
  // These users will be handled via FNF settlement instead
  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(
      year,
      month,
      0,
    ).getDate()}`;

    query += `
      AND (
        u."lastWorkingDate" IS NULL 
        OR u."lastWorkingDate" < $2::date
        OR u."lastWorkingDate" > $3::date
      )
    `;
    params.push(startDate, endDate);
  }

  return { query, params };
};

export const buildAttendanceSummaryForPayrollQuery = (
  userId: string,
  startDate: string,
  endDate: string,
) => {
  const query = `
    SELECT
      COUNT(CASE WHEN a."status" IN ('${AttendanceStatus.PRESENT}', '${AttendanceStatus.APPROVAL_PENDING}') THEN 1 END)::int as "presentDays",
      COUNT(CASE WHEN a."status" = '${AttendanceStatus.ABSENT}' THEN 1 END)::int as "absentDays",
      COUNT(CASE WHEN a."status" = '${AttendanceStatus.HALF_DAY}' THEN 1 END)::int as "halfDays",
      COUNT(CASE WHEN a."status" = '${AttendanceStatus.LEAVE}' THEN 1 END)::int as "paidLeaveDays",
      COUNT(CASE WHEN a."status" = '${AttendanceStatus.LEAVE_WITHOUT_PAY}' THEN 1 END)::int as "unpaidLeaveDays",
      COUNT(CASE WHEN a."status" = '${AttendanceStatus.HOLIDAY}' THEN 1 END)::int as "holidays"
    FROM "attendances" a
    WHERE a."userId" = $1
      AND a."attendanceDate" >= $2::date
      AND a."attendanceDate" <= $3::date
      AND a."isActive" = true
      AND a."approvalStatus" = 'approved'
  `;

  return { query, params: [userId, startDate, endDate] };
};

export const buildLeaveSummaryForPayrollQuery = (
  userId: string,
  startDate: string,
  endDate: string,
) => {
  const query = `
    SELECT
      la."leaveCategory",
      la."leaveType",
      COUNT(*)::int as "count"
    FROM "leave_applications" la
    WHERE la."userId" = $1
      AND la."fromDate" >= $2::date
      AND la."fromDate" <= $3::date
      AND la."approvalStatus" = 'approved'
    GROUP BY la."leaveCategory", la."leaveType"
  `;

  return { query, params: [userId, startDate, endDate] };
};

export const buildPresentDatesForPayrollQuery = (
  userId: string,
  startDate: string,
  endDate: string,
) => {
  const query = `
    SELECT 
      a."attendanceDate"::text as "attendanceDate"
    FROM "attendances" a
    WHERE a."userId" = $1
      AND a."attendanceDate" >= $2::date
      AND a."attendanceDate" <= $3::date
      AND a."isActive" = true
      AND a."approvalStatus" = 'approved'
      AND a."status" IN ('${AttendanceStatus.PRESENT}', '${AttendanceStatus.CHECKED_IN}', '${AttendanceStatus.CHECKED_OUT}', '${AttendanceStatus.APPROVAL_PENDING}')
  `;

  return { query, params: [userId, startDate, endDate] };
};

export const buildUserExitCheckQuery = (userId: string) => {
  const query = `
    SELECT u."lastWorkingDate"
    FROM users u
    WHERE u.id = $1
      AND u."lastWorkingDate" IS NOT NULL
  `;

  return { query, params: [userId] };
};

export const buildSalaryReportQuery = (options: {
  year: number;
  startMonth: number;
  endMonth: number;
  userId?: string;
  status?: string;
}) => {
  const { year, startMonth, endMonth, userId, status } = options;
  const params: (string | number)[] = [year, startMonth, endMonth];
  let paramIndex = 4;

  let query = `
    SELECT 
      p."id",
      p."userId",
      u."firstName",
      u."lastName",
      u."employeeId",
      u."email",
      p."month",
      p."year",
      p."grossEarnings",
      p."totalDeductions",
      p."netPayable",
      p."status",
      p."paidAt"
    FROM "payroll" p
    LEFT JOIN "users" u ON u."id" = p."userId"
    WHERE p."year" = $1
      AND p."month" >= $2
      AND p."month" <= $3
  `;

  if (userId) {
    query += ` AND p."userId" = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  if (status) {
    query += ` AND p."status" = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY u."firstName" ASC, u."lastName" ASC, p."month" ASC`;

  return { query, params };
};
