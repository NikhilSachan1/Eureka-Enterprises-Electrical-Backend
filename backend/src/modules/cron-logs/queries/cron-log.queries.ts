import { CronLogQueryDto } from '../dto';

export const buildCronLogStatsQuery = () => {
  const query = `
    SELECT 
      "jobName",
      "status",
      COUNT(*)::int as "count",
      ROUND(AVG("durationMs"))::int as "avgDurationMs",
      MAX("startedAt") as "lastRun"
    FROM "cron_logs"
    GROUP BY "jobName", "status"
    ORDER BY "jobName", "status"
  `;
  return { query, params: [] };
};

export const buildCronLogListQuery = (queryDto: CronLogQueryDto) => {
  const {
    jobName,
    jobType,
    status,
    triggeredBy,
    startDate,
    endDate,
    page,
    pageSize,
    sortField,
    sortOrder,
  } = queryDto;

  const filters: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (jobName) {
    filters.push(`cl."jobName" = $${paramIndex}`);
    params.push(jobName);
    paramIndex++;
  }

  if (jobType) {
    filters.push(`cl."jobType" = $${paramIndex}`);
    params.push(jobType);
    paramIndex++;
  }

  if (status) {
    filters.push(`cl."status" = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (triggeredBy) {
    filters.push(`cl."triggeredBy" = $${paramIndex}`);
    params.push(triggeredBy);
    paramIndex++;
  }

  if (startDate && endDate) {
    filters.push(`cl."startedAt" BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(startDate, endDate + 'T23:59:59.999Z');
    paramIndex += 2;
  } else if (startDate) {
    filters.push(`cl."startedAt" >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  } else if (endDate) {
    filters.push(`cl."startedAt" <= $${paramIndex}`);
    params.push(endDate + 'T23:59:59.999Z');
    paramIndex++;
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const sortFieldMap: Record<string, string> = {
    startedAt: 'cl."startedAt"',
    completedAt: 'cl."completedAt"',
    durationMs: 'cl."durationMs"',
    jobName: 'cl."jobName"',
    status: 'cl."status"',
    createdAt: 'cl."createdAt"',
  };

  const orderByColumn = sortFieldMap[sortField] || 'cl."startedAt"';
  const offset = (page - 1) * pageSize;

  const dataQuery = `
    SELECT 
      cl."id",
      cl."jobName",
      cl."jobType",
      cl."status",
      cl."startedAt",
      cl."completedAt",
      cl."durationMs",
      cl."result",
      cl."errorMessage",
      cl."triggeredBy",
      cl."createdBy",
      cl."createdAt",
      CASE WHEN u."id" IS NOT NULL THEN
        json_build_object(
          'id', u."id",
          'firstName', u."firstName",
          'lastName', u."lastName",
          'email', u."email"
        )
      ELSE NULL END as "createdByUser"
    FROM "cron_logs" cl
    LEFT JOIN "users" u ON cl."createdBy" = u."id"
    ${whereClause}
    ORDER BY ${orderByColumn} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countQuery = `
    SELECT COUNT(*)::int as "total"
    FROM "cron_logs" cl
    ${whereClause}
  `;

  const countParams = [...params];
  params.push(pageSize, offset);

  return { dataQuery, countQuery, params, countParams };
};

export const buildRecentFailuresQuery = (hours: number) => {
  const query = `
    SELECT 
      cl."id",
      cl."jobName",
      cl."jobType",
      cl."status",
      cl."startedAt",
      cl."completedAt",
      cl."durationMs",
      cl."errorMessage",
      cl."errorStack",
      cl."triggeredBy",
      cl."createdAt"
    FROM "cron_logs" cl
    WHERE cl."status" = 'FAILED'
      AND cl."startedAt" >= NOW() - INTERVAL '${hours} hours'
    ORDER BY cl."startedAt" DESC
  `;
  return { query, params: [] };
};
