/**
 * Contractor-related SQL queries
 * Centralized location for all raw SQL queries used in contractor module
 */

/**
 * Get site statistics grouped by contractor
 * Returns: contractorId, totalSites, activeSites, upcomingSites, completedSites, holdSites
 */
export const getSiteStatsByContractorQuery = `
  SELECT 
    sc."contractorId",
    COUNT(*) as "totalSites",
    COUNT(*) FILTER (WHERE s.status = 'ongoing') as "activeSites",
    COUNT(*) FILTER (WHERE s.status = 'upcoming') as "upcomingSites",
    COUNT(*) FILTER (WHERE s.status = 'completed') as "completedSites",
    COUNT(*) FILTER (WHERE s.status = 'hold') as "holdSites"
  FROM site_contractors sc
  INNER JOIN sites s ON s.id = sc."siteId" AND s."deletedAt" IS NULL
  WHERE sc."contractorId" = ANY($1)
  GROUP BY sc."contractorId"
`;

/**
 * Get document/financial statistics grouped by contractor.
 *
 * site_documents previously held financial figures (totalAmount, paymentStatus,
 * documentType IN PO/INVOICE) but those columns were dropped by migration
 * 1835000000000-repurpose-site-documents-drop-financial-fields. Financial data
 * now lives in the dedicated tables — site_invoices for invoiced amounts,
 * purchase_orders for PO totals — so this query sources from there. The
 * remaining site_documents joins cover ONLY non-financial documents
 * (contracts, completion certificates, photos, etc.).
 */
export const getDocumentStatsByContractorQuery = `
  WITH inv AS (
    SELECT "contractorId",
           COUNT(*)::int AS "totalInvoices",
           COALESCE(SUM("totalAmount"), 0) AS "totalAmountBilled",
           COUNT(*) FILTER (
             WHERE "approvalStatus" = 'APPROVED'
               AND "paidTotal" < "totalAmount"
           )::int AS "pendingPayments"
      FROM site_invoices
     WHERE "contractorId" = ANY($1)
       AND "deletedAt" IS NULL
     GROUP BY "contractorId"
  ),
  docs AS (
    SELECT "contractorId", COUNT(*)::int AS "totalDocuments"
      FROM site_documents
     WHERE "contractorId" = ANY($1)
       AND "deletedAt" IS NULL
     GROUP BY "contractorId"
  )
  SELECT
    c.id AS "contractorId",
    COALESCE(docs."totalDocuments", 0) AS "totalDocuments",
    COALESCE(inv."totalInvoices", 0) AS "totalInvoices",
    0::int AS "totalQuotations",
    COALESCE(inv."totalAmountBilled", 0) AS "totalAmountBilled",
    COALESCE(inv."pendingPayments", 0) AS "pendingPayments"
  FROM contractors c
  LEFT JOIN inv  ON inv."contractorId"  = c.id
  LEFT JOIN docs ON docs."contractorId" = c.id
  WHERE c.id = ANY($1)
`;

/**
 * Get overall contractor statistics (for summary/aggregates)
 * Returns: totalContractors, activeContractors, inactiveContractors, archivedContractors, selfContractors
 */
export const getOverallContractorStatsQuery = `
  SELECT 
    COUNT(*) FILTER (WHERE c."deletedAt" IS NULL) as "totalContractors",
    COUNT(*) FILTER (WHERE c."isActive" = true AND c."deletedAt" IS NULL) as "activeContractors",
    COUNT(*) FILTER (WHERE c."isActive" = false AND c."deletedAt" IS NULL) as "inactiveContractors",
    COUNT(*) FILTER (WHERE c."deletedAt" IS NOT NULL) as "archivedContractors",
    COUNT(*) FILTER (WHERE c."isSelfContractor" = true AND c."deletedAt" IS NULL) as "selfContractors"
  FROM contractors c
`;

/**
 * Check if a contractor is assigned to any active (non-deleted) sites
 * Returns: count of sites for the contractor
 */
export const getContractorSiteCountQuery = `
  SELECT COUNT(*) as "siteCount"
  FROM site_contractors sc
  INNER JOIN sites s ON s.id = sc."siteId" AND s."deletedAt" IS NULL
  WHERE sc."contractorId" = $1
`;

/**
 * Check if a contractor has any active site associations (for delete validation).
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkContractorHasSitesQuery = `
  SELECT 1 FROM site_contractors sc
  INNER JOIN sites s ON s.id = sc."siteId" AND s."deletedAt" IS NULL
  WHERE sc."contractorId" = $1
  LIMIT 1
`;

/**
 * Check if a contractor has pending or partially paid invoices (for delete validation).
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkContractorHasPendingInvoicesQuery = `
  SELECT 1
  FROM site_invoices
  WHERE "contractorId" = $1
    AND "deletedAt" IS NULL
    AND ("approvalStatus" <> 'APPROVED' OR "paidTotal" < "totalAmount")
  LIMIT 1
`;
