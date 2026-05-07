export const PAYMENT_ADVICE_REFERENCE_PREFIX = 'EE/TA';

export const PAYMENT_ADVICE_ERRORS = {
  NOT_FOUND: 'Payment advice not found.',
  EMAIL_VALIDATION_FAILED: 'At least one "to" email is required.',
  BANK_TRANSFER_NOT_FOUND: 'Bank transfer not found.',
  EMAIL_SEND_FAILED: (reason: string) => `Failed to send payment advice email: ${reason}`,
};

export const PAYMENT_ADVICE_RESPONSES = {
  EMAIL_SENT: 'Payment advice email sent successfully.',
  DELETED: 'Payment advice deleted successfully.',
};
