/**
 * Company-related SQL queries
 * Centralized location for all raw SQL queries used in company module
 */

/**
 * Get site statistics grouped by company
 * Returns: companyId, totalSites, activeSites, upcomingSites, completedSites, holdSites
 */
export const getSiteStatsByCompanyQuery = `
  SELECT 
    s."companyId",
    COUNT(*) as "totalSites",
    COUNT(*) FILTER (WHERE s.status = 'ongoing') as "activeSites",
    COUNT(*) FILTER (WHERE s.status = 'upcoming') as "upcomingSites",
    COUNT(*) FILTER (WHERE s.status = 'completed') as "completedSites",
    COUNT(*) FILTER (WHERE s.status = 'hold') as "holdSites"
  FROM sites s
  WHERE s."companyId" = ANY($1)
    AND s."deletedAt" IS NULL
  GROUP BY s."companyId"
`;

/**
 * Get child company statistics grouped by parent company
 * Returns: parentCompanyId, activeChildCompanies, inactiveChildCompanies, archivedChildCompanies
 */
export const getChildCompanyStatsByParentQuery = `
  SELECT 
    c."parentCompanyId",
    COUNT(*) FILTER (WHERE c."isActive" = true AND c."deletedAt" IS NULL) as "activeChildCompanies",
    COUNT(*) FILTER (WHERE c."isActive" = false AND c."deletedAt" IS NULL) as "inactiveChildCompanies",
    COUNT(*) FILTER (WHERE c."deletedAt" IS NOT NULL) as "archivedChildCompanies"
  FROM companies c
  WHERE c."parentCompanyId" = ANY($1)
  GROUP BY c."parentCompanyId"
`;

/**
 * Get overall company statistics (for summary/aggregates)
 * Returns: totalCompanies, activeCompanies, inactiveCompanies, archivedCompanies
 */
export const getOverallCompanyStatsQuery = `
  SELECT 
    COUNT(*) FILTER (WHERE c."deletedAt" IS NULL) as "totalCompanies",
    COUNT(*) FILTER (WHERE c."isActive" = true AND c."deletedAt" IS NULL) as "activeCompanies",
    COUNT(*) FILTER (WHERE c."isActive" = false AND c."deletedAt" IS NULL) as "inactiveCompanies",
    COUNT(*) FILTER (WHERE c."deletedAt" IS NOT NULL) as "archivedCompanies"
  FROM companies c
`;
