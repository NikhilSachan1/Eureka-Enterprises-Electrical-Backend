/** Indian FY quarters: Q1 = Apr–Jun, Q2 = Jul–Sep, Q3 = Oct–Dec, Q4 = Jan–Mar. */
export const LEDGER_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type LedgerQuarter = (typeof LEDGER_QUARTERS)[number];

/**
 * Where the invoice payment stands, after advances:
 * PAID = nothing left to pay / receive, PARTIAL = some received, UNPAID = nothing received yet.
 */
export const LEDGER_PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'UNPAID'] as const;
export type LedgerPaymentStatus = (typeof LEDGER_PAYMENT_STATUSES)[number];

/** Amount columns on a ledger row and in the totals; all sent as numbers rounded to paise. */
export const LEDGER_AMOUNT_FIELDS = [
  'taxableAmount',
  'cgstAmount',
  'sgstAmount',
  'igstAmount',
  'gstAmount',
  'grossAmount',
  'tdsAmount',
  'netPayable',
  'advanceAdjusted',
  'paidAmount',
  'outstandingAmount',
] as const;

/** Client sort fields → ledger CTE columns. Anything else sorts by invoice date, oldest first. */
export const LEDGER_SORT_COLUMNS: Record<string, string> = {
  invoiceDate: '"invoiceDate"',
  invoiceNumber: '"invoiceNumber"',
  taxableAmount: '"taxableAmount"',
  grossAmount: '"grossAmount"',
  tdsAmount: '"tdsAmount"',
  paidAmount: '"paidAmount"',
  outstandingAmount: '"outstandingAmount"',
};
