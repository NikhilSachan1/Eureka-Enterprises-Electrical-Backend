export enum OverallStatus {
  JMC_PENDING            = 'JMC_PENDING',
  JMC_REJECTED           = 'JMC_REJECTED',
  REPORT_MISSING         = 'REPORT_MISSING',
  INVOICE_MISSING        = 'INVOICE_MISSING',
  INVOICE_PENDING        = 'INVOICE_PENDING',
  INVOICE_REJECTED       = 'INVOICE_REJECTED',
  BOOK_PAYMENT_MISSING   = 'BOOK_PAYMENT_MISSING',
  BANK_TRANSFER_PENDING  = 'BANK_TRANSFER_PENDING',
  BANK_TRANSFER_PARTIAL  = 'BANK_TRANSFER_PARTIAL',
  COMPLETE               = 'COMPLETE',
}

/**
 * Static next-action messages. BANK_TRANSFER_PARTIAL is dynamic
 * (includes ₹ amounts) and is built in the service layer.
 */
export const NEXT_ACTION: Record<OverallStatus, string | null> = {
  [OverallStatus.JMC_PENDING]:           'JMC awaiting approval',
  [OverallStatus.JMC_REJECTED]:          'JMC was rejected — review and re-submit',
  [OverallStatus.REPORT_MISSING]:        'Upload site report to proceed',
  [OverallStatus.INVOICE_MISSING]:       'Invoice not yet created',
  [OverallStatus.INVOICE_PENDING]:       'Invoice awaiting approval',
  [OverallStatus.INVOICE_REJECTED]:      'Invoice was rejected — review and re-submit',
  [OverallStatus.BOOK_PAYMENT_MISSING]:  'Book payment not recorded yet',
  [OverallStatus.BANK_TRANSFER_PENDING]: 'Bank transfer not done — payment not released',
  [OverallStatus.BANK_TRANSFER_PARTIAL]: null, // built dynamically with ₹ amounts
  [OverallStatus.COMPLETE]:              null,
};

/**
 * SQL CASE expression for overall status priority — used in both endpoints.
 * Identical logic; defined once to keep queries in sync.
 *
 * Column aliases expected in scope:
 *   j."approvalStatus", j."partyType",
 *   sr.id (site_reports),
 *   si.id, si."approvalStatus", si."paidTotal", si."taxableAmount" (site_invoices),
 *   bp.id, bp."hasTransfer" (book_payments)
 */
export const OVERALL_STATUS_CASE = `
  CASE
    WHEN j."approvalStatus" = 'PENDING'  THEN 'JMC_PENDING'
    WHEN j."approvalStatus" = 'REJECTED' THEN 'JMC_REJECTED'
    WHEN j."partyType" = 'PURCHASE' AND sr.id IS NULL                                                   THEN 'REPORT_MISSING'
    WHEN si.id IS NULL                                                                                   THEN 'INVOICE_MISSING'
    WHEN si."approvalStatus" = 'PENDING'                                                                 THEN 'INVOICE_PENDING'
    WHEN si."approvalStatus" = 'REJECTED'                                                                THEN 'INVOICE_REJECTED'
    WHEN j."partyType" = 'PURCHASE' AND bp.id IS NULL                                                   THEN 'BOOK_PAYMENT_MISSING'
    WHEN j."partyType" = 'PURCHASE' AND bp."hasTransfer" = false                                         THEN 'BANK_TRANSFER_PENDING'
    WHEN j."partyType" = 'SALE'     AND COALESCE(si."paidTotal", 0) = 0                                 THEN 'BANK_TRANSFER_PENDING'
    WHEN j."partyType" = 'SALE'     AND COALESCE(si."paidTotal", 0) < si."taxableAmount"                THEN 'BANK_TRANSFER_PARTIAL'
    ELSE 'COMPLETE'
  END
`;
