export enum OverallStatus {
  JMC_PENDING = 'JMC_PENDING',
  JMC_REJECTED = 'JMC_REJECTED',
  REPORT_MISSING = 'REPORT_MISSING',
  INVOICE_MISSING = 'INVOICE_MISSING',
  INVOICE_PENDING = 'INVOICE_PENDING',
  INVOICE_REJECTED = 'INVOICE_REJECTED',
  BOOK_PAYMENT_MISSING = 'BOOK_PAYMENT_MISSING',
  BANK_TRANSFER_PENDING = 'BANK_TRANSFER_PENDING',
  BANK_TRANSFER_PARTIAL = 'BANK_TRANSFER_PARTIAL',
  /**
   * An advance was paid to a vendor and no invoice has covered it yet.
   *
   * Unlike every other status here this one is **PO-anchored, not JMC-anchored** — an advance
   * exists precisely because no JMC has been raised. Rows carrying it have `jmc: null`, which
   * consumers of getIssues must tolerate.
   */
  ADVANCE_UNSETTLED = 'ADVANCE_UNSETTLED',
  COMPLETE = 'COMPLETE',
}

/**
 * Static next-action messages. BANK_TRANSFER_PARTIAL is dynamic
 * (includes ₹ amounts) and is built in the service layer.
 */
export const NEXT_ACTION: Record<OverallStatus, string | null> = {
  [OverallStatus.JMC_PENDING]: 'JMC awaiting approval',
  [OverallStatus.JMC_REJECTED]: 'JMC was rejected — review and re-submit',
  [OverallStatus.REPORT_MISSING]: 'Upload site report to proceed',
  [OverallStatus.INVOICE_MISSING]: 'Invoice not yet created',
  [OverallStatus.INVOICE_PENDING]: 'Invoice awaiting approval',
  [OverallStatus.INVOICE_REJECTED]: 'Invoice was rejected — review and re-submit',
  [OverallStatus.BOOK_PAYMENT_MISSING]: 'Book payment not recorded yet',
  [OverallStatus.BANK_TRANSFER_PENDING]: 'Bank transfer not done — payment not released',
  [OverallStatus.BANK_TRANSFER_PARTIAL]: null, // built dynamically with ₹ amounts
  [OverallStatus.ADVANCE_UNSETTLED]: 'Invoice pending against advance paid',
  [OverallStatus.COMPLETE]: null,
};

/**
 * The advance half of the issues list — PO-anchored rows for advances no invoice has covered.
 *
 * Column list and order match the JMC branch exactly so the two can be UNIONed. JMC-only columns
 * are NULL: an advance has no JMC, no report and no invoice, which is the whole point of it.
 * `advanceDate` stands in for `jmcDate` so the shared sort and date filters keep working.
 */
export const ADVANCE_ISSUE_BRANCH = `
  SELECT
    s.id   AS "siteId",
    s.name AS "siteName",
    co.name AS "companyName",

    NULL::uuid    AS "jmcId",
    NULL::varchar AS "jmcNumber",
    ap."advanceDate" AS "jmcDate",
    'PURCHASE'    AS "partyType",
    NULL::varchar AS "jmcStatus",

    v.name AS "partyName",

    po.id  AS "poId",
    po."poNumber",
    po."approvalStatus" AS "poStatus",

    NULL::uuid AS "reportId",

    NULL::uuid    AS "invoiceId",
    NULL::varchar AS "invoiceStatus",
    NULL::numeric AS "invoiceTaxableAmount",
    NULL::numeric AS "invoiceTotalAmount",
    0::numeric    AS "invoiceTdsAmount",
    0::numeric    AS "paidTotal",

    NULL::uuid    AS "bookPaymentId",
    NULL::numeric AS "paymentTotalAmount",
    NULL::boolean AS "hasTransfer",

    ap.id AS "advanceId",
    ap."advanceNumber",
    ap.amount AS "advanceAmount",
    (ap.amount - ap."settledAmount") AS "advanceUnsettled",

    'ADVANCE_UNSETTLED' AS "overallStatus"

  FROM advance_payments ap
  JOIN purchase_orders po ON po.id = ap."poId" AND po."deletedAt" IS NULL
  JOIN sites s      ON s.id = ap."siteId" AND s."deletedAt" IS NULL
  JOIN companies co ON co.id = s."companyId" AND co."deletedAt" IS NULL
  LEFT JOIN vendors v ON v.id = ap."vendorId" AND v."deletedAt" IS NULL
  WHERE ap."deletedAt" IS NULL
    AND ap."approvalStatus" = 'APPROVED'
    AND ap.amount > ap."settledAmount"
`;

/**
 * SQL CASE expression for overall status priority — used in both endpoints.
 * Identical logic; defined once to keep queries in sync.
 *
 * Column aliases expected in scope:
 *   j."approvalStatus", j."partyType",
 *   sr.id (site_reports),
 *   si.id, si."approvalStatus", si."paidTotal", si."taxableAmount", si."tdsAmount" (site_invoices),
 *   bp.id, bp."hasTransfer" (book_payments)
 */
export const OVERALL_STATUS_CASE = `
  CASE
    WHEN j."approvalStatus" = 'PENDING'  THEN 'JMC_PENDING'
    WHEN j."approvalStatus" = 'REJECTED' THEN 'JMC_REJECTED'
    WHEN j."partyType" = 'PURCHASE' AND sr.id IS NULL                                                                                 THEN 'REPORT_MISSING'
    WHEN si.id IS NULL                                                                                                                 THEN 'INVOICE_MISSING'
    WHEN si."approvalStatus" = 'PENDING'                                                                                               THEN 'INVOICE_PENDING'
    WHEN si."approvalStatus" = 'REJECTED'                                                                                              THEN 'INVOICE_REJECTED'
    WHEN j."partyType" = 'PURCHASE' AND bp.id IS NULL                                                                                  THEN 'BOOK_PAYMENT_MISSING'
    WHEN j."partyType" = 'PURCHASE' AND bp."hasTransfer" = false                                                                       THEN 'BANK_TRANSFER_PENDING'
    WHEN j."partyType" = 'SALE'     AND COALESCE(si."paidTotal", 0) = 0                                                               THEN 'BANK_TRANSFER_PENDING'
    WHEN j."partyType" = 'SALE'     AND COALESCE(si."paidTotal", 0) < si."taxableAmount" - COALESCE(si."tdsAmount", 0)                THEN 'BANK_TRANSFER_PARTIAL'
    ELSE 'COMPLETE'
  END
`;
