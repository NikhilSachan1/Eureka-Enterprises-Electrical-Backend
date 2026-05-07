/**
 * Raw SQL queries for billing summaries and site closing readiness.
 * These are used when the aggregations are complex enough that TypeORM queries
 * become unwieldy.
 */

export const BILLING_QUERIES = {
  /**
   * PO-wise summary per BRD §8.
   * Returns: poId, poNumber, partyType, contractorOrVendorName, poTotal,
   * invoicedTotal, bookedTotal, paidTotal, gstCut, tdsCut, uninvoiced, pendingBilling
   */
  PO_SUMMARY: `
    SELECT
      po.id as "poId",
      po."poNumber",
      po."partyType",
      po."siteId",
      COALESCE(c.name, v.name) as "partyName",
      po."totalAmount" as "poTotal",
      po."invoicedTotal",
      po."bookedTotal",
      po."paidTotal",
      COALESCE((
        SELECT SUM(inv."gstAmount")
        FROM site_invoices inv
        WHERE inv."poId" = po.id
          AND inv."approvalStatus" = 'APPROVED'
          AND inv."deletedAt" IS NULL
      ), 0) as "gstCut",
      COALESCE((
        SELECT SUM(inv."tdsAmount")
        FROM site_invoices inv
        WHERE inv."poId" = po.id
          AND inv."approvalStatus" = 'APPROVED'
          AND inv."deletedAt" IS NULL
      ), 0) as "tdsCut",
      (po."totalAmount" - po."invoicedTotal") as "uninvoiced",
      (po."invoicedTotal" - po."paidTotal") as "pendingBilling"
    FROM purchase_orders po
    LEFT JOIN contractors c ON po."contractorId" = c.id
    LEFT JOIN vendors v ON po."vendorId" = v.id
    WHERE po.id = $1
      AND po."deletedAt" IS NULL
  `,

  /**
   * Site-level summary — aggregates all POs for a site.
   */
  SITE_SUMMARY: `
    SELECT
      po."siteId",
      po."partyType",
      COUNT(*) as "poCount",
      SUM(po."totalAmount") as "totalPOAmount",
      SUM(po."invoicedTotal") as "totalInvoiced",
      SUM(po."bookedTotal") as "totalBooked",
      SUM(po."paidTotal") as "totalPaid",
      SUM(po."totalAmount" - po."invoicedTotal") as "totalUninvoiced",
      SUM(po."invoicedTotal" - po."paidTotal") as "totalPendingBilling"
    FROM purchase_orders po
    WHERE po."siteId" = $1
      AND po."deletedAt" IS NULL
    GROUP BY po."siteId", po."partyType"
  `,

  /**
   * Check if all contractors/vendors attached to a site have at least one approved PO.
   */
  PARTIES_WITH_PO: `
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM site_contractors sc
          WHERE sc."siteId" = $1
            AND NOT EXISTS (
              SELECT 1 FROM purchase_orders po
              WHERE po."siteId" = $1
                AND po."contractorId" = sc."contractorId"
                AND po."approvalStatus" = 'APPROVED'
                AND po."deletedAt" IS NULL
            )
        ) THEN false
        WHEN EXISTS (
          SELECT 1 FROM site_vendors sv
          WHERE sv."siteId" = $1
            AND NOT EXISTS (
              SELECT 1 FROM purchase_orders po
              WHERE po."siteId" = $1
                AND po."vendorId" = sv."vendorId"
                AND po."approvalStatus" = 'APPROVED'
                AND po."deletedAt" IS NULL
            )
        ) THEN false
        ELSE true
      END as "allPartiesHavePO"
  `,

  /**
   * Check for any PENDING or REJECTED documents.
   */
  PENDING_OR_REJECTED_DOCS: `
    SELECT 'PO' as "docType", id, "poNumber" as "number"
    FROM purchase_orders
    WHERE "siteId" = $1 AND "approvalStatus" IN ('PENDING', 'REJECTED') AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'JMC' as "docType", id, "jmcNumber" as "number"
    FROM jmcs
    WHERE "siteId" = $1 AND "approvalStatus" IN ('PENDING', 'REJECTED') AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'Invoice' as "docType", id, "invoiceNumber" as "number"
    FROM site_invoices
    WHERE "siteId" = $1 AND "approvalStatus" IN ('PENDING', 'REJECTED') AND "deletedAt" IS NULL
  `,

  /**
   * Check if all invoices are fully paid (sum of bank transfers = invoice total).
   */
  UNPAID_INVOICES: `
    SELECT inv.id, inv."invoiceNumber", inv."partyType",
           inv."totalAmount" as "invoiceTotal",
           inv."paidTotal",
           (inv."totalAmount" - inv."paidTotal") as "unpaid"
    FROM site_invoices inv
    WHERE inv."siteId" = $1
      AND inv."approvalStatus" = 'APPROVED'
      AND inv."paidTotal" < inv."totalAmount"
      AND inv."deletedAt" IS NULL
  `,

  /**
   * Check GST/TDS settlement status.
   */
  UNVERIFIED_GST_TDS: `
    SELECT 'GST' as "type", COUNT(*) as "count"
    FROM gst_register_entries
    WHERE "siteId" = $1
      AND "partyType" = 'PURCHASE'
      AND "isVerified" = false
      AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'GST_UNPAID' as "type", COUNT(*) as "count"
    FROM gst_register_entries
    WHERE "siteId" = $1
      AND "partyType" = 'PURCHASE'
      AND "isVerified" = true
      AND "gstPaymentId" IS NULL
      AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'TDS' as "type", COUNT(*) as "count"
    FROM tds_register_entries
    WHERE "siteId" = $1
      AND "isVerified" = false
      AND "deletedAt" IS NULL
    UNION ALL
    SELECT 'TDS_UNPAID' as "type", COUNT(*) as "count"
    FROM tds_register_entries
    WHERE "siteId" = $1
      AND "isVerified" = true
      AND "tdsPaymentId" IS NULL
      AND "deletedAt" IS NULL
  `,
};
