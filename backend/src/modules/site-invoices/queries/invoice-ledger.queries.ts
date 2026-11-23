/**
 * Invoice ledger SQL. `{where}` is filled with the invoice-level conditions and `{ledgerWhere}`
 * with the conditions on computed columns (quarter, payment status); both are built from
 * whitelisted fragments and bound parameters only.
 *
 * Amount rules match `buildInvoicePaymentSummary`, so the ledger agrees with the invoice screens:
 *   net payable = taxable − TDS + GST (GST left out when it is held)
 *   outstanding = net payable − advances adjusted − paid, never below zero
 * GST is split by the PO's tax type: CGST_SGST halves it, IGST keeps it whole.
 */
export const invoiceLedgerCte = `
  WITH base AS (
    SELECT
      i."id",
      i."partyType",
      i."invoiceNumber",
      i."invoiceDate",
      i."approvalStatus",
      i."isGstHold",
      i."createdAt",
      COALESCE(i."taxableAmount", 0)::numeric        AS "taxableAmount",
      COALESCE(i."gstAmount", 0)::numeric            AS "gstAmount",
      i."gstPercentage",
      COALESCE(i."tdsAmount", 0)::numeric            AS "tdsAmount",
      i."tdsPercentage",
      COALESCE(i."taxableAmount", 0)::numeric
        + COALESCE(i."gstAmount", 0)::numeric        AS "grossAmount",
      COALESCE(i."advanceSettledAmount", 0)::numeric AS "advanceAdjusted",
      COALESCE(i."paidTotal", 0)::numeric            AS "paidAmount",
      COALESCE(po."gstType", 'CGST_SGST')            AS "gstType",
      po."poNumber",
      j."jmcNumber",
      s."id"   AS "siteId",
      s."name" AS "siteName",
      c."id"   AS "companyId",
      c."name" AS "companyName",
      COALESCE(ct."name", v."name") AS "partyName",
      CASE WHEN i."invoiceDate" IS NULL THEN NULL ELSE
        (EXTRACT(YEAR FROM i."invoiceDate")::int
          - CASE WHEN EXTRACT(MONTH FROM i."invoiceDate") < 4 THEN 1 ELSE 0 END)
      END AS "fyStartYear",
      CASE WHEN i."invoiceDate" IS NULL THEN NULL ELSE
        'Q' || (((EXTRACT(MONTH FROM i."invoiceDate")::int + 8) % 12) / 3 + 1)
      END AS "quarter"
    FROM site_invoices i
    INNER JOIN sites s           ON s."id" = i."siteId"
    LEFT JOIN companies c        ON c."id" = s."companyId"
    LEFT JOIN purchase_orders po ON po."id" = i."poId"
    LEFT JOIN jmcs j             ON j."id" = i."jmcId"
    LEFT JOIN contractors ct     ON ct."id" = i."contractorId"
    LEFT JOIN vendors v          ON v."id" = i."vendorId"
    WHERE {where}
  ),
  amounts AS (
    SELECT
      b.*,
      ROUND(b."taxableAmount" - b."tdsAmount"
        + CASE WHEN b."isGstHold" AND b."gstAmount" > 0 THEN 0 ELSE b."gstAmount" END, 2) AS "netPayable"
    FROM base b
  ),
  ledger AS (
    SELECT
      a.*,
      GREATEST(ROUND(a."netPayable" - a."advanceAdjusted" - a."paidAmount", 2), 0) AS "outstandingAmount",
      CASE
        WHEN GREATEST(ROUND(a."netPayable" - a."advanceAdjusted" - a."paidAmount", 2), 0) = 0 THEN 'PAID'
        WHEN a."paidAmount" + a."advanceAdjusted" > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
      END AS "paymentStatus",
      CASE WHEN a."gstType" = 'IGST' THEN 0 ELSE ROUND(a."gstAmount" / 2, 2) END AS "cgstAmount",
      CASE WHEN a."gstType" = 'IGST' THEN 0 ELSE a."gstAmount" - ROUND(a."gstAmount" / 2, 2) END AS "sgstAmount",
      CASE WHEN a."gstType" = 'IGST' THEN a."gstAmount" ELSE 0 END AS "igstAmount"
    FROM amounts a
  ),
  filtered AS (
    SELECT * FROM ledger WHERE {ledgerWhere}
  )
`;

/** One page of ledger rows with the regular (non-GST) bank transfers that paid each invoice. */
export const invoiceLedgerPageQuery = `
  ${invoiceLedgerCte}
  SELECT
    f."id", f."partyType", f."invoiceNumber",
    TO_CHAR(f."invoiceDate", 'YYYY-MM-DD') AS "invoiceDate",
    CASE WHEN f."fyStartYear" IS NULL THEN NULL
      ELSE f."fyStartYear"::text || '-' || LPAD(((f."fyStartYear" + 1) % 100)::text, 2, '0')
    END AS "financialYear",
    f."quarter", f."approvalStatus", f."isGstHold", f."gstType",
    f."gstPercentage", f."tdsPercentage",
    f."taxableAmount", f."cgstAmount", f."sgstAmount", f."igstAmount", f."gstAmount",
    f."grossAmount", f."tdsAmount", f."netPayable", f."advanceAdjusted", f."paidAmount",
    f."outstandingAmount", f."paymentStatus",
    f."poNumber", f."jmcNumber", f."siteId", f."siteName", f."companyId", f."companyName",
    f."partyName",
    pay."payments"
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'date', TO_CHAR(bt."transferDate", 'YYYY-MM-DD'),
          'amount', bt."transferAmount",
          'utrNumber', bt."utrNumber"
        ) ORDER BY bt."transferDate", bt."createdAt"
      ),
      '[]'::json
    ) AS "payments"
    FROM bank_transfers bt
    LEFT JOIN book_payments bp ON bp."id" = bt."bookPaymentId"
    WHERE bt."deletedAt" IS NULL
      AND bt."paymentType" = 'REGULAR'
      -- SALE carries invoiceId on the transfer; PURCHASE reaches the invoice through its booking.
      AND (bt."invoiceId" = f."id" OR bp."invoiceId" = f."id")
  ) pay ON true
  ORDER BY {orderBy}
  LIMIT {limit} OFFSET {offset}
`;

/** Totals over every row that matches the filters, not just the page. */
export const invoiceLedgerTotalsQuery = `
  ${invoiceLedgerCte}
  SELECT
    COUNT(*)::int                          AS "totalRecords",
    COALESCE(SUM("taxableAmount"), 0)     AS "taxableAmount",
    COALESCE(SUM("cgstAmount"), 0)        AS "cgstAmount",
    COALESCE(SUM("sgstAmount"), 0)        AS "sgstAmount",
    COALESCE(SUM("igstAmount"), 0)        AS "igstAmount",
    COALESCE(SUM("gstAmount"), 0)         AS "gstAmount",
    COALESCE(SUM("grossAmount"), 0)       AS "grossAmount",
    COALESCE(SUM("tdsAmount"), 0)         AS "tdsAmount",
    COALESCE(SUM("netPayable"), 0)        AS "netPayable",
    COALESCE(SUM("advanceAdjusted"), 0)   AS "advanceAdjusted",
    COALESCE(SUM("paidAmount"), 0)        AS "paidAmount",
    COALESCE(SUM("outstandingAmount"), 0) AS "outstandingAmount"
  FROM filtered
`;
