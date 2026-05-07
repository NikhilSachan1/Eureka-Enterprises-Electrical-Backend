export const TDS_ERRORS = {
  ENTRY_NOT_FOUND: 'TDS register entry not found.',
  PAYMENT_NOT_FOUND: 'TDS payment not found.',
  ALREADY_VERIFIED: 'Entry is already verified.',
  NOT_VERIFIED: 'Entry is not verified.',
  CANNOT_REVERT_PAYMENT_RELEASED: 'Cannot revert — payment has already been released.',
  NO_VERIFIED_ENTRIES: 'No verified entries found for the specified party and month.',
  PAYMENT_ALREADY_EXISTS: 'A TDS payment already exists for this party and month.',
  INVALID_PARTY_CONTRACTOR: 'For SALE side, contractorId is required.',
  INVALID_PARTY_VENDOR: 'For PURCHASE side, vendorId is required.',
};

export const TDS_RESPONSES = {
  ENTRY_VERIFIED: 'TDS register entry verified successfully.',
  ENTRY_REVERTED: 'TDS register entry verification reverted.',
  PAYMENT_RELEASED: 'TDS payment released successfully.',
};
