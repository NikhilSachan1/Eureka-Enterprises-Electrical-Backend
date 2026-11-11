export const TDS_ERRORS = {
  ENTRY_NOT_FOUND: 'TDS register entry not found.',
  PAYMENT_NOT_FOUND: 'TDS challan not found.',
  ALREADY_VERIFIED: 'Entry is already verified.',
  NOT_VERIFIED: 'Entry is not verified.',
  NO_ENTRIES: 'No TDS register entries were selected.',
  ENTRIES_NOT_FOUND: 'One or more entries not found.',
  CHALLAN_REQUIRED_BEFORE_VERIFY: (invoiceNumber: string) =>
    `Record the TDS challan for invoice ${invoiceNumber} before verifying it in 26Q.`,
  SALE_HAS_NO_CHALLAN:
    'TDS on sales is deducted and deposited by the client. Verify it in Form 26AS instead of recording a challan.',
  ALREADY_IN_CHALLAN: (invoiceNumber: string) =>
    `TDS on invoice ${invoiceNumber} is already included in a deposited challan.`,
  MIXED_SITE: 'All selected entries must belong to the same site.',
};

export const TDS_RESPONSES = {
  ENTRY_VERIFIED: 'TDS register entry verified successfully.',
  ENTRY_REVERTED: 'TDS register entry verification reverted.',
  CHALLAN_RECORDED: 'TDS challan recorded successfully.',
};
