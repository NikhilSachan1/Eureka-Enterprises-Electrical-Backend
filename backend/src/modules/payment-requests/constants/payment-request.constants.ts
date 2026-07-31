export const PAYMENT_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const PAYMENT_REQUEST_ERRORS = {
  NOT_FOUND: 'Payment request not found',
  INVOICE_NOT_FOUND: 'Invoice not found',
  NOT_PENDING: 'Only a PENDING payment request can be actioned.',
};

export const PAYMENT_REQUEST_RESPONSES = {
  CREATED: 'Payment request submitted successfully',
  APPROVED: 'Payment request approved — book payment created',
  REJECTED: 'Payment request rejected',
};
