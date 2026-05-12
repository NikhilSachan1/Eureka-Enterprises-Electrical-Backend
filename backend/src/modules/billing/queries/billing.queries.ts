/**
 * Raw SQL queries for billing summaries and site closing readiness.
 * These are used when the aggregations are complex enough that TypeORM queries
 * become unwieldy.
 */

export const BILLING_QUERIES = {
  /**
   * PO-wise summary per BRD §8 — enhanced.
   * Includes: PO details, document counts, financial rollups,
   * GST breakdown (invoiced / paid / pending),
   * TDS breakdown (deducted / paid / pending).
   */
  PO_SUMMARY: `
    SELECT
      -- PO identity
      po.id                        AS "poId",
      po."poNumber",
      po."poDate",
      po."partyType",
      po."siteId",
      po."approvalStatus",
      po."isLocked",
      po."taxableAmount"           AS "poTaxableAmount",
      po."gstAmount"               AS "poGstAmount",
      po."gstPercentage"           AS "poGstPercentage",
      po."totalAmount"             AS "poTotal",
      po."contractorId",
      po."vendorId",
      COALESCE(c.name, v.name)     AS "partyName",
      COALESCE(c.email, v.email)   AS "partyEmail",
      COALESCE(c."gstNumber", v."gstNumber") AS "partyGstNumber",

      -- Financial rollups (maintained transactionally on PO)
      po."invoicedTotal",
      po."bookedTotal",
      po."paidTotal",
      (po."totalAmount" - po."invoicedTotal") AS "uninvoiced",
      (po."invoicedTotal" - po."paidTotal")   AS "pendingPayment",

      -- Document counts
      (SELECT COUNT(*)::int FROM jmcs j
        WHERE j."poId" = po.id AND j."deletedAt" IS NULL)                          AS "jmcCount",
      (SELECT COUNT(*)::int FROM jmcs j
        WHERE j."poId" = po.id AND j."approvalStatus" = 'APPROVED' AND j."deletedAt" IS NULL) AS "jmcApprovedCount",
      (SELECT COUNT(*)::int FROM jmcs j
        WHERE j."poId" = po.id AND j."approvalStatus" = 'PENDING'  AND j."deletedAt" IS NULL) AS "jmcPendingCount",

      (SELECT COUNT(*)::int FROM site_reports sr
        JOIN jmcs j2 ON j2.id = sr."jmcId"
        WHERE j2."poId" = po.id AND sr."deletedAt" IS NULL)                        AS "reportCount",

      (SELECT COUNT(*)::int FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."deletedAt" IS NULL)                      AS "invoiceCount",
      (SELECT COUNT(*)::int FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."approvalStatus" = 'APPROVED' AND inv."deletedAt" IS NULL) AS "invoiceApprovedCount",
      (SELECT COUNT(*)::int FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."approvalStatus" = 'PENDING'  AND inv."deletedAt" IS NULL) AS "invoicePendingCount",
      (SELECT COUNT(*)::int FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."approvalStatus" = 'REJECTED' AND inv."deletedAt" IS NULL) AS "invoiceRejectedCount",

      (SELECT COUNT(*)::int FROM book_payments bp
        JOIN site_invoices inv2 ON inv2.id = bp."invoiceId"
        WHERE inv2."poId" = po.id AND bp."deletedAt" IS NULL)                      AS "bookPaymentCount",

      (SELECT COUNT(*)::int FROM bank_transfers bt
        LEFT JOIN site_invoices inv3 ON inv3.id = bt."invoiceId"
        LEFT JOIN book_payments bp2  ON bp2.id  = bt."bookPaymentId"
        LEFT JOIN site_invoices inv4 ON inv4.id = bp2."invoiceId"
        WHERE COALESCE(inv3."poId", inv4."poId") = po.id AND bt."deletedAt" IS NULL) AS "bankTransferCount",

      -- GST breakdown
      COALESCE((
        SELECT SUM(inv."gstAmount")
        FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."approvalStatus" = 'APPROVED' AND inv."deletedAt" IS NULL
      ), 0) AS "gstInvoiced",

      COALESCE((
        SELECT SUM(gp."netAmount")
        FROM gst_payments gp
        WHERE gp."siteId" = po."siteId"
          AND (po."partyType" = 'PURCHASE')
          AND gp."vendorId" = po."vendorId"
          AND gp."deletedAt" IS NULL
      ), 0) AS "gstPaid",

      -- TDS breakdown
      COALESCE((
        SELECT SUM(inv."tdsAmount")
        FROM site_invoices inv
        WHERE inv."poId" = po.id AND inv."approvalStatus" = 'APPROVED' AND inv."deletedAt" IS NULL
      ), 0) AS "tdsDeducted",

      COALESCE((
        SELECT SUM(tp."netAmount")
        FROM tds_payments tp
        WHERE tp."siteId" = po."siteId"
          AND (
            (po."partyType" = 'SALE'     AND tp."contractorId" = po."contractorId")
            OR
            (po."partyType" = 'PURCHASE' AND tp."vendorId"     = po."vendorId")
          )
          AND tp."deletedAt" IS NULL
      ), 0) AS "tdsPaid"

    FROM purchase_orders po
    LEFT JOIN contractors c ON po."contractorId" = c.id AND c."deletedAt" IS NULL
    LEFT JOIN vendors     v ON po."vendorId"     = v.id AND v."deletedAt" IS NULL
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
   * Check if any PO has been invoiced beyond its total amount.
   */
  INVOICE_OVER_PO: `
    SELECT po.id, po."poNumber", po."totalAmount" as "poTotal", po."invoicedTotal"
    FROM purchase_orders po
    WHERE po."siteId" = $1
      AND po."invoicedTotal" > po."totalAmount"
      AND po."deletedAt" IS NULL
  `,

  /**
   * Approved SALE invoices that have not been fully paid.
   */
  UNPAID_SALE_INVOICES: `
    SELECT inv.id, inv."invoiceNumber", (inv."totalAmount" - inv."paidTotal") as "unpaid"
    FROM site_invoices inv
    WHERE inv."siteId" = $1
      AND inv."partyType" = 'SALE'
      AND inv."approvalStatus" = 'APPROVED'
      AND inv."paidTotal" < inv."totalAmount"
      AND inv."deletedAt" IS NULL
  `,

  /**
   * Approved PURCHASE invoices that have not been fully paid.
   */
  UNPAID_PURCHASE_INVOICES: `
    SELECT inv.id, inv."invoiceNumber", (inv."totalAmount" - inv."paidTotal") as "unpaid"
    FROM site_invoices inv
    WHERE inv."siteId" = $1
      AND inv."partyType" = 'PURCHASE'
      AND inv."approvalStatus" = 'APPROVED'
      AND inv."paidTotal" < inv."totalAmount"
      AND inv."deletedAt" IS NULL
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
