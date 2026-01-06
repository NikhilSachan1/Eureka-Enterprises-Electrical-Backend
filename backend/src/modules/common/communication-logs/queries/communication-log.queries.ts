export const buildCommunicationLogStatsQuery = (fromDate?: Date, toDate?: Date) => {
  const dateFilter = fromDate && toDate ? `AND "createdAt" BETWEEN $1 AND $2` : '';
  const params = fromDate && toDate ? [fromDate, toDate] : [];

  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'SENT') as "totalSent",
      COUNT(*) FILTER (WHERE status = 'FAILED') as "totalFailed",
      COUNT(*) FILTER (WHERE status = 'PENDING') as "totalPending",
      COUNT(*) FILTER (WHERE status = 'DELIVERED') as "totalDelivered",
      COUNT(*) FILTER (WHERE status = 'READ') as "totalRead",
      COUNT(*) as "total"
    FROM communication_logs
    WHERE "deletedAt" IS NULL ${dateFilter}
  `;

  return { query, params };
};

export const buildChannelStatsQuery = (fromDate?: Date, toDate?: Date) => {
  const dateFilter = fromDate && toDate ? `AND "createdAt" BETWEEN $1 AND $2` : '';
  const params = fromDate && toDate ? [fromDate, toDate] : [];

  const query = `
    SELECT 
      channel,
      COUNT(*) as count
    FROM communication_logs
    WHERE "deletedAt" IS NULL ${dateFilter}
    GROUP BY channel
  `;

  return { query, params };
};

export const buildCategoryStatsQuery = (fromDate?: Date, toDate?: Date) => {
  const dateFilter = fromDate && toDate ? `AND "createdAt" BETWEEN $1 AND $2` : '';
  const params = fromDate && toDate ? [fromDate, toDate] : [];

  const query = `
    SELECT 
      category,
      COUNT(*) as count
    FROM communication_logs
    WHERE "deletedAt" IS NULL ${dateFilter}
    GROUP BY category
  `;

  return { query, params };
};

export const buildStatusStatsQuery = (fromDate?: Date, toDate?: Date) => {
  const dateFilter = fromDate && toDate ? `AND "createdAt" BETWEEN $1 AND $2` : '';
  const params = fromDate && toDate ? [fromDate, toDate] : [];

  const query = `
    SELECT 
      status,
      COUNT(*) as count
    FROM communication_logs
    WHERE "deletedAt" IS NULL ${dateFilter}
    GROUP BY status
  `;

  return { query, params };
};
