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
 * Get document/financial statistics grouped by contractor
 * Returns: contractorId, totalDocuments, totalInvoices, totalQuotations, totalAmountBilled, pendingPayments
 */
export const getDocumentStatsByContractorQuery = `
  SELECT 
    sd."contractorId",
    COUNT(*) as "totalDocuments",
    COUNT(*) FILTER (WHERE sd."documentType" = 'INVOICE') as "totalInvoices",
    COUNT(*) FILTER (WHERE sd."documentType" = 'QUOTATION') as "totalQuotations",
    COALESCE(SUM(sd."totalAmount"), 0) as "totalAmountBilled",
    COUNT(*) FILTER (WHERE sd."paymentStatus" = 'PENDING') as "pendingPayments"
  FROM site_documents sd
  WHERE sd."contractorId" = ANY($1)
    AND sd."deletedAt" IS NULL
  GROUP BY sd."contractorId"
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
