/**
 * Raw SQL queries for GST module.
 * These queries handle complex aggregations for GST register and payment summaries.
 */

export const GST_QUERIES = {
  /**
   * GST summary per BRD §5.3.
   * Returns aggregated data by partyType and gstType.
   */
  GST_SUMMARY: `
    SELECT
      "partyType",
      "gstType",
      SUM("taxableAmount") as "totalTaxable",
      SUM("gstAmount") as "totalGst",
      COUNT(*) FILTER (WHERE "isVerified" = true) as "verifiedCount",
      COUNT(*) FILTER (WHERE "isVerified" = false) as "unverifiedCount",
      SUM("gstAmount") FILTER (WHERE "gstPaymentId" IS NOT NULL) as "paidGst",
      SUM("gstAmount") FILTER (WHERE "gstPaymentId" IS NULL AND "isVerified" = true) as "pendingGst"
    FROM gst_register_entries
    WHERE "siteId" = $1
      AND "financialYear" = $2
      AND "deletedAt" IS NULL
    GROUP BY "partyType", "gstType"
  `,

  /**
   * Get verified, unpaid GST entries for a vendor/month (for payment release).
   */
  VERIFIED_UNPAID_ENTRIES: `
    SELECT *
    FROM gst_register_entries
    WHERE "siteId" = $1
      AND "vendorId" = $2
      AND "invoiceMonth" = $3
      AND "partyType" = 'PURCHASE'
      AND "isVerified" = true
      AND "gstPaymentId" IS NULL
      AND "deletedAt" IS NULL
  `,

  /**
   * Get GST payment totals by vendor/month.
   */
  PAYMENT_TOTALS_BY_VENDOR: `
    SELECT
      "vendorId",
      "paymentMonth",
      SUM("netAmount") as "totalPaid"
    FROM gst_payments
    WHERE "siteId" = $1
      AND "financialYear" = $2
      AND "deletedAt" IS NULL
    GROUP BY "vendorId", "paymentMonth"
  `,
};
