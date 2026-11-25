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
      i."invoiceNumber",
      i."invoiceDate",
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
      s."name"  AS "siteName",
      s."city"  AS "siteCity",
      s."state" AS "siteState",
      c."name"  AS "companyName",
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
  settled AS (
    SELECT
      a.*,
      GREATEST(ROUND(a."netPayable" - a."advanceAdjusted" - a."paidAmount", 2), 0) AS "outstandingAmount"
    FROM amounts a
  ),
  ledger AS (
    SELECT
      st.*,
      CASE
        WHEN st."outstandingAmount" = 0 THEN 'PAID'
        WHEN st."paidAmount" + st."advanceAdjusted" > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
      END AS "paymentStatus",
      CASE WHEN st."gstType" = 'IGST' THEN 0 ELSE ROUND(st."gstAmount" / 2, 2) END AS "cgstAmount",
      CASE WHEN st."gstType" = 'IGST' THEN 0 ELSE st."gstAmount" - ROUND(st."gstAmount" / 2, 2) END AS "sgstAmount",
      CASE WHEN st."gstType" = 'IGST' THEN st."gstAmount" ELSE 0 END AS "igstAmount"
    FROM settled st
  ),
  filtered AS (
    SELECT * FROM ledger WHERE {ledgerWhere}
  )
`;

/**
 * One page of ledger rows with the regular (non-GST) bank transfers that paid each invoice.
 * SALE transfers carry the invoice id; PURCHASE ones reach it through their booking — two indexed
 * lookups (UNION ALL) rather than one OR, so neither has to scan every transfer.
 */
export const invoiceLedgerPageQuery = `
  ${invoiceLedgerCte}
  SELECT
    f."id", f."invoiceNumber",
    TO_CHAR(f."invoiceDate", 'YYYY-MM-DD') AS "invoiceDate",
    CASE WHEN f."fyStartYear" IS NULL THEN NULL
      ELSE f."fyStartYear"::text || '-' || LPAD(((f."fyStartYear" + 1) % 100)::text, 2, '0')
    END AS "financialYear",
    f."quarter", f."isGstHold", f."gstPercentage", f."tdsPercentage",
    f."taxableAmount", f."cgstAmount", f."sgstAmount", f."igstAmount", f."gstAmount",
    f."grossAmount", f."tdsAmount", f."advanceAdjusted", f."paidAmount",
    f."outstandingAmount", f."paymentStatus",
    f."poNumber", f."siteName", f."siteCity", f."siteState", f."companyName", f."partyName",
    pay."payments"
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      json_agg(
        json_build_object('date', TO_CHAR(t."transferDate", 'YYYY-MM-DD'), 'amount', t."transferAmount")
        ORDER BY t."transferDate", t."createdAt"
      ),
      '[]'::json
    ) AS "payments"
    FROM (
      SELECT bt."transferDate", bt."transferAmount", bt."createdAt"
        FROM bank_transfers bt
       WHERE bt."invoiceId" = f."id"
         AND bt."paymentType" = 'REGULAR' AND bt."deletedAt" IS NULL
      UNION ALL
      SELECT bt."transferDate", bt."transferAmount", bt."createdAt"
        FROM book_payments bp
        JOIN bank_transfers bt ON bt."bookPaymentId" = bp."id"
       WHERE bp."invoiceId" = f."id" AND bp."deletedAt" IS NULL
         AND bt."paymentType" = 'REGULAR' AND bt."deletedAt" IS NULL
    ) t
  ) pay ON true
  ORDER BY {orderBy}
  LIMIT {limit} OFFSET {offset}
`;

/**
 * Everything above the table, in one statement so the filtered ledger is built once:
 * totals over every matching row, billed vs outstanding for the latest 12 invoice months
 * (oldest first), and the five contractors / vendors with the most outstanding.
 */
export const invoiceLedgerSummaryQuery = `
  ${invoiceLedgerCte}
  SELECT
    (
      SELECT row_to_json(t) FROM (
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
      ) t
    ) AS "totals",
    (
      SELECT COALESCE(json_agg(m ORDER BY m."month"), '[]'::json) FROM (
        SELECT
          TO_CHAR(date_trunc('month', "invoiceDate"), 'YYYY-MM') AS "month",
          COALESCE(SUM("grossAmount"), 0)                       AS "billed",
          COALESCE(SUM("outstandingAmount"), 0)                 AS "outstanding"
        FROM filtered
        WHERE "invoiceDate" IS NOT NULL
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      ) m
    ) AS "byMonth",
    (
      SELECT COALESCE(json_agg(p ORDER BY p."outstanding" DESC), '[]'::json) FROM (
        SELECT
          COALESCE("partyName", '—')            AS "partyName",
          COUNT(*)::int                         AS "count",
          COALESCE(SUM("outstandingAmount"), 0) AS "outstanding"
        FROM filtered
        GROUP BY 1
        HAVING SUM("outstandingAmount") > 0
        ORDER BY SUM("outstandingAmount") DESC
        LIMIT 5
      ) p
    ) AS "topParties"
`;
