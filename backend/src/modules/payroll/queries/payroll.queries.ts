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

export const buildActiveUsersWithSalaryQuery = (status: string) => {
  const query = `
    SELECT DISTINCT u.id as "userId"
    FROM users u
    INNER JOIN salary_structures ss ON ss."userId" = u.id
    WHERE u.status = $1
      AND u."deletedAt" IS NULL
      AND ss."isActive" = true
  `;

  return { query, params: [status] };
};
