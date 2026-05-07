/**
 * JMC-related SQL queries
 */

/**
 * Check if a JMC has any child records (site reports or site invoices).
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkJmcHasChildrenQuery = `
  SELECT 1 FROM site_reports WHERE "jmcId" = $1 AND "deletedAt" IS NULL
  UNION ALL
  SELECT 1 FROM site_invoices WHERE "jmcId" = $1 AND "deletedAt" IS NULL
  LIMIT 1
`;
