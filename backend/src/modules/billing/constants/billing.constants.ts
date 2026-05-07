export const BILLING_ERRORS = {
  PO_NOT_FOUND: 'Purchase order not found.',
} as const;

export const CLOSING_CONDITION_IDS = {
  EVERY_PARTY_HAS_APPROVED_PO: 'every-party-has-approved-po',
  INVOICE_NOT_EXCEEDING_PO: 'invoice-not-exceeding-po',
  SALE_FULLY_PAID: 'sale-fully-paid',
  PURCHASE_FULLY_PAID: 'purchase-fully-paid',
  NO_PENDING_OR_REJECTED_DOCS: 'no-pending-or-rejected-docs',
  GST_TDS_SETTLED: 'gst-tds-settled',
} as const;

export const CLOSING_CONDITION_DETAILS = {
  PARTIES_WITHOUT_PO: 'One or more contractors/vendors do not have an approved PO.',
  PO_INVOICED_OVER_TOTAL: (poNumber: string, invoicedTotal: number, poTotal: number) =>
    `PO ${poNumber} has invoiced ${invoicedTotal} > PO total ${poTotal}`,
  INVOICE_UNPAID: (invoiceNumber: string, unpaid: number) =>
    `Invoice ${invoiceNumber} has ${unpaid} unpaid`,
  GST_TDS_ENTRIES: (type: string, count: number) => `${type}: ${count} entries`,
} as const;
