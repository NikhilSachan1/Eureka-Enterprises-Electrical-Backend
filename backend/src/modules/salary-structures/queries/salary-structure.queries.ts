export const buildSalaryHistoryQuery = (userId: string) => {
  const query = `
    SELECT 
      ss.*,
      json_agg(
        json_build_object(
          'id', scl."id",
          'changeType', scl."changeType",
          'previousValues', scl."previousValues",
          'newValues', scl."newValues",
          'changedBy', scl."changedBy",
          'changedAt', scl."changedAt",
          'reason', scl."reason"
        )
      ) FILTER (WHERE scl."id" IS NOT NULL) as "changeLogs"
    FROM "salary_structures" ss
    LEFT JOIN "salary_change_logs" scl ON scl."salaryStructureId" = ss."id"
    WHERE ss."userId" = $1
    GROUP BY ss."id"
    ORDER BY ss."effectiveFrom" DESC
  `;

  return { query, params: [userId] };
};
