export const buildRequestAuditCleanupQuery = (days: number) => {
  const query = `
    DELETE FROM "request_audit_logs"
    WHERE "timestamp" < NOW() - INTERVAL '${days} days'
    RETURNING id
  `;
  return { query, params: [] };
};

export const buildEntityAuditCleanupQuery = (days: number) => {
  const query = `
    DELETE FROM "entity_audit_logs"
    WHERE "timestamp" < NOW() - INTERVAL '${days} days'
    RETURNING id
  `;
  return { query, params: [] };
};

export const buildRequestAuditStatsQuery = () => {
  const query = `
    SELECT 
      COUNT(*)::int as "total",
      COUNT(CASE WHEN "responseStatus" >= 200 AND "responseStatus" < 300 THEN 1 END)::int as "success",
      COUNT(CASE WHEN "responseStatus" >= 400 AND "responseStatus" < 500 THEN 1 END)::int as "clientErrors",
      COUNT(CASE WHEN "responseStatus" >= 500 THEN 1 END)::int as "serverErrors",
      ROUND(AVG("responseTimeMs")::numeric, 2) as "avgResponseTimeMs",
      MAX("responseTimeMs")::int as "maxResponseTimeMs",
      MIN("responseTimeMs")::int as "minResponseTimeMs",
      COUNT(DISTINCT "userId")::int as "uniqueUsers",
      MIN("timestamp") as "oldestLog",
      MAX("timestamp") as "latestLog"
    FROM "request_audit_logs"
  `;
  return { query, params: [] };
};

export const buildEntityAuditStatsQuery = () => {
  const query = `
    SELECT 
      COUNT(*)::int as "total",
      COUNT(CASE WHEN "action" = 'CREATE' THEN 1 END)::int as "creates",
      COUNT(CASE WHEN "action" = 'UPDATE' THEN 1 END)::int as "updates",
      COUNT(CASE WHEN "action" = 'DELETE' THEN 1 END)::int as "deletes",
      COUNT(CASE WHEN "action" = 'SOFT_DELETE' THEN 1 END)::int as "softDeletes",
      COUNT(DISTINCT "entityName")::int as "uniqueEntities",
      COUNT(DISTINCT "changedBy")::int as "uniqueUsers",
      MIN("timestamp") as "oldestLog",
      MAX("timestamp") as "latestLog"
    FROM "entity_audit_logs"
  `;
  return { query, params: [] };
};

export const buildTopEndpointsQuery = (limit = 10) => {
  const query = `
    SELECT 
      "method",
      "url",
      COUNT(*)::int as "requestCount",
      ROUND(AVG("responseTimeMs")::numeric, 2) as "avgResponseTimeMs",
      COUNT(CASE WHEN "responseStatus" >= 400 THEN 1 END)::int as "errorCount"
    FROM "request_audit_logs"
    GROUP BY "method", "url"
    ORDER BY "requestCount" DESC
    LIMIT $1
  `;
  return { query, params: [limit] };
};

export const buildTopEntitiesQuery = (limit = 10) => {
  const query = `
    SELECT 
      "entityName",
      COUNT(*)::int as "changeCount",
      COUNT(CASE WHEN "action" = 'CREATE' THEN 1 END)::int as "creates",
      COUNT(CASE WHEN "action" = 'UPDATE' THEN 1 END)::int as "updates",
      COUNT(CASE WHEN "action" = 'DELETE' OR "action" = 'SOFT_DELETE' THEN 1 END)::int as "deletes"
    FROM "entity_audit_logs"
    GROUP BY "entityName"
    ORDER BY "changeCount" DESC
    LIMIT $1
  `;
  return { query, params: [limit] };
};
