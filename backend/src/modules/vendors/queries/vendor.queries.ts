/**
 * Vendor-related SQL queries
 * Centralized location for all raw SQL queries used in vendor module
 */

/**
 * Get site statistics grouped by vendor
 */
export const getSiteStatsByVendorQuery = `
  SELECT
    sv."vendorId",
    COUNT(*) as "totalSites",
    COUNT(*) FILTER (WHERE s.status = 'ongoing') as "activeSites",
    COUNT(*) FILTER (WHERE s.status = 'upcoming') as "upcomingSites",
    COUNT(*) FILTER (WHERE s.status = 'completed') as "completedSites",
    COUNT(*) FILTER (WHERE s.status = 'hold') as "holdSites"
  FROM site_vendors sv
  INNER JOIN sites s ON s.id = sv."siteId" AND s."deletedAt" IS NULL
  WHERE sv."vendorId" = ANY($1)
  GROUP BY sv."vendorId"
`;

/**
 * Get financial document statistics grouped by vendor
 * (POs + Invoices on the PURCHASE side)
 */
export const getFinancialStatsByVendorQuery = `
  SELECT
    po."vendorId",
    COUNT(DISTINCT po.id) as "totalPos",
    COALESCE(SUM(po."totalAmount"), 0) as "totalPoAmount",
    COALESCE(SUM(po."invoicedTotal"), 0) as "totalInvoicedAmount",
    COALESCE(SUM(po."paidTotal"), 0) as "totalPaidAmount"
  FROM purchase_orders po
  WHERE po."vendorId" = ANY($1)
    AND po."partyType" = 'PURCHASE'
    AND po."deletedAt" IS NULL
  GROUP BY po."vendorId"
`;

/**
 * Check if a vendor has any active site associations (for delete validation).
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkVendorHasSitesQuery = `
  SELECT 1 FROM site_vendors sv
  INNER JOIN sites s ON s.id = sv."siteId" AND s."deletedAt" IS NULL
  WHERE sv."vendorId" = $1
  LIMIT 1
`;

/**
 * Check if a vendor has any active purchase orders (for delete validation).
 * Returns 1 row if found, 0 rows if safe to delete.
 */
export const checkVendorHasPurchaseOrdersQuery = `
  SELECT 1 FROM purchase_orders
  WHERE "vendorId" = $1
    AND "partyType" = 'PURCHASE'
    AND "deletedAt" IS NULL
  LIMIT 1
`;

/**
 * Get overall vendor statistics
 */
export const getOverallVendorStatsQuery = `
  SELECT
    COUNT(*) FILTER (WHERE v."deletedAt" IS NULL) as "totalVendors",
    COUNT(*) FILTER (WHERE v."isActive" = true AND v."deletedAt" IS NULL) as "activeVendors",
    COUNT(*) FILTER (WHERE v."isActive" = false AND v."deletedAt" IS NULL) as "inactiveVendors",
    COUNT(*) FILTER (WHERE v."deletedAt" IS NOT NULL) as "archivedVendors",
    COUNT(*) FILTER (WHERE v."vendorType" = 'FREELANCER' AND v."deletedAt" IS NULL) as "freelancerVendors",
    COUNT(*) FILTER (WHERE v."vendorType" = 'GST_REGISTERED' AND v."deletedAt" IS NULL) as "gstRegisteredVendors"
  FROM vendors v
`;
