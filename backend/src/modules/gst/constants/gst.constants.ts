// Plan §5.1.14 — the GST Payment Advice carries the same EE/TA reference
// prefix as a regular Payment Advice, but allocates from a separate sequence
// (gst_payment_advice_sequences) so its numbering is independent.
// BRD §5.2 does not name a distinct prefix — the company uses a single
// tenant-wide reference scheme for all Payment Advices.
export const GST_PAYMENT_ADVICE_PREFIX = 'EE/TA';

export const GST_ERRORS = {
  ENTRY_NOT_FOUND: 'GST register entry not found.',
  PAYMENT_NOT_FOUND: 'GST payment not found.',
  CANNOT_VERIFY_SALE: 'Verification is only applicable to PURCHASE side entries.',
  ALREADY_VERIFIED: 'Entry is already verified.',
  NOT_VERIFIED: 'Entry is not verified.',
  CANNOT_REVERT_PAYMENT_RELEASED: 'Cannot revert — payment has already been released.',
  NO_VERIFIED_ENTRIES: 'No verified entries found for the specified vendor and month.',
  PAYMENT_ALREADY_EXISTS: 'A GST payment already exists for this vendor and month.',
};

export const GST_RESPONSES = {
  ENTRY_VERIFIED: 'GST register entry verified successfully.',
  ENTRY_REVERTED: 'GST register entry verification reverted.',
  PAYMENT_RELEASED: 'GST payment released successfully.',
};
