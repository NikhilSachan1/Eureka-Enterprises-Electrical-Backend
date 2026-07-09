/**
 * Live-pending recompute helpers — mirror the pending-settlement logic so the sheet
 * can reconcile against current data (§8 of the spec).
 */

/** Expense pending for a single user = Σ(approved debit) − Σ(credit), active rows only. */
export const userExpensePendingQuery = (userId: string) => ({
  query: `
    SELECT (
      COALESCE(SUM(CASE WHEN e."transactionType" = 'debit' AND e."approvalStatus" = 'approved' THEN e."amount"::numeric ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN e."transactionType" = 'credit' THEN e."amount"::numeric ELSE 0 END), 0)
    ) AS "pending"
    FROM "expenses" e
    WHERE e."isActive" = true AND e."userId" = $1
  `,
  params: [userId],
});

/** Fuel pending for a single user = Σ(approved debit) − Σ(credit), active rows only. */
export const userFuelPendingQuery = (userId: string) => ({
  query: `
    SELECT (
      COALESCE(SUM(CASE WHEN fe."transactionType" = 'debit' AND fe."approvalStatus" = 'approved' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN fe."transactionType" = 'credit' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)
    ) AS "pending"
    FROM "fuel_expenses" fe
    WHERE fe."isActive" = true AND fe."userId" = $1
  `,
  params: [userId],
});

/**
 * Transferable amount of specific book payments that are still un-transferred and
 * approved. Used both to value a vendor allocation and to recompute its live pending.
 */
export const bookPaymentsTransferableQuery = (bookPaymentIds: string[]) => ({
  query: `
    SELECT
      bp."id" AS "bookPaymentId",
      (bp."paymentTotalAmount"::numeric - COALESCE(bp."paymentHoldAmount"::numeric, 0)) AS "transferable",
      bp."hasTransfer",
      bp."approvalStatus",
      bp."vendorId"
    FROM "book_payments" bp
    WHERE bp."id" = ANY($1) AND bp."deletedAt" IS NULL
  `,
  params: [bookPaymentIds],
});

/** Aggregate live pending (expense) for a batch of users, one row per user — for GET enrichment. */
export const usersExpensePendingQuery = (userIds: string[]) => ({
  query: `
    SELECT
      e."userId",
      (
        COALESCE(SUM(CASE WHEN e."transactionType" = 'debit' AND e."approvalStatus" = 'approved' THEN e."amount"::numeric ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN e."transactionType" = 'credit' THEN e."amount"::numeric ELSE 0 END), 0)
      ) AS "pending"
    FROM "expenses" e
    WHERE e."isActive" = true AND e."userId" = ANY($1)
    GROUP BY e."userId"
  `,
  params: [userIds],
});

/** Aggregate live pending (fuel) for a batch of users, one row per user — for GET enrichment. */
export const usersFuelPendingQuery = (userIds: string[]) => ({
  query: `
    SELECT
      fe."userId",
      (
        COALESCE(SUM(CASE WHEN fe."transactionType" = 'debit' AND fe."approvalStatus" = 'approved' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN fe."transactionType" = 'credit' THEN fe."fuelAmount"::numeric ELSE 0 END), 0)
      ) AS "pending"
    FROM "fuel_expenses" fe
    WHERE fe."isActive" = true AND fe."userId" = ANY($1)
    GROUP BY fe."userId"
  `,
  params: [userIds],
});

/**
 * Per-book-payment invoice/site/company detail, for the vendor item settlement
 * breakdown in GET /payment-sheets/:id. One row per book payment id.
 *
 * invoiceNetPayable: isGstHold ? taxable − tds : taxable + gst − tds.
 * invoicePendingToBook = invoiceNetPayable − invoiceBookedTotal (still un-booked, overall).
 */
export const bookPaymentInvoiceDetailQuery = (bookPaymentIds: string[]) => {
  const invNetPayable = `(CASE WHEN inv."isGstHold" = true
      THEN COALESCE(inv."taxableAmount"::numeric, 0) - COALESCE(inv."tdsAmount"::numeric, 0)
      ELSE COALESCE(inv."taxableAmount"::numeric, 0) + COALESCE(inv."gstAmount"::numeric, 0) - COALESCE(inv."tdsAmount"::numeric, 0)
    END)`;
  return {
    query: `
      SELECT
        bp."id"                  AS "bookPaymentId",
        inv."id"                 AS "invoiceId",
        inv."invoiceNumber",
        inv."invoiceDate",
        inv."bookedTotal"        AS "invoiceBookedTotal",
        ${invNetPayable}         AS "invoiceNetPayableAmount",
        (${invNetPayable} - COALESCE(inv."bookedTotal"::numeric, 0)) AS "invoicePendingToBook",
        c."id"                   AS "companyId",
        c."name"                 AS "companyName",
        s."id"                   AS "siteId",
        s."name"                 AS "siteName",
        s."city"                 AS "siteCity",
        s."state"                AS "siteState"
      FROM "book_payments" bp
      INNER JOIN "site_invoices" inv ON inv."id" = bp."invoiceId" AND inv."deletedAt" IS NULL
      INNER JOIN "sites"         s   ON s."id"   = bp."siteId"    AND s."deletedAt" IS NULL
      INNER JOIN "companies"     c   ON c."id"   = s."companyId"  AND c."deletedAt" IS NULL
      WHERE bp."id" = ANY($1) AND bp."deletedAt" IS NULL
    `,
    params: [bookPaymentIds],
  };
};
