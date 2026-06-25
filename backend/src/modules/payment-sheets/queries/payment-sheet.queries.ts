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
