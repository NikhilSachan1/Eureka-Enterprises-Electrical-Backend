// Plan §5.1.14 — the GST Payment Advice carries the same EE/TA reference
// prefix as a regular Payment Advice, but allocates from a separate sequence
// (gst_payment_advice_sequences) so its numbering is independent.
// BRD §5.2 does not name a distinct prefix — the company uses a single
// tenant-wide reference scheme for all Payment Advices.
export const GST_PAYMENT_ADVICE_PREFIX = 'EE/TA';

export const GST_ERRORS = {
  ENTRY_NOT_FOUND: 'GST register entry not found.',
  PAYMENT_NOT_FOUND: 'GST payment not found.',
  ALREADY_VERIFIED: 'Entry is already verified.',
  NOT_VERIFIED: 'Entry is not verified.',
  CANNOT_REVERT_SETTLED: 'Cannot revert — the held GST has already been settled.',
  NO_ENTRIES: 'No GST register entries were selected.',
  ENTRIES_NOT_FOUND: 'One or more entries not found.',
  NOT_HELD: (invoiceNumber: string) =>
    `GST on invoice ${invoiceNumber} was not held — it was settled with the invoice payment, so there is nothing to release.`,
  ALREADY_SETTLED: (invoiceNumber: string) =>
    `Held GST on invoice ${invoiceNumber} has already been settled.`,
  PURCHASE_NOT_VERIFIED: (invoiceNumber: string) =>
    `Invoice ${invoiceNumber} is not verified in GSTR-2B yet. Release held GST to the vendor only after it reflects in GSTR-2B.`,
  MIXED_SITE_OR_SIDE: 'All selected entries must belong to the same site and party type.',
  MIXED_VENDOR: 'All selected entries must belong to the same vendor.',
  MIXED_CONTRACTOR: 'All selected entries must belong to the same contractor.',
};

export const GST_RESPONSES = {
  ENTRY_VERIFIED: 'GST register entry verified successfully.',
  ENTRY_REVERTED: 'GST register entry verification reverted.',
  RELEASED_TO_VENDOR: 'Held GST released to the vendor successfully.',
  RECEIVED_FROM_CLIENT: 'Held GST received from the client recorded successfully.',
};
