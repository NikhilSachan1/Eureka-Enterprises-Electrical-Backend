/**
 * Purchase-order-related SQL queries
 */

/**
 * Check if a PO has any child JMC records.
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkPoHasJmcsQuery = `
  SELECT 1 FROM jmcs WHERE "poId" = $1 AND "deletedAt" IS NULL LIMIT 1
`;
