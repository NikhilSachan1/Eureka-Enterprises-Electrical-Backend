export const PAYMENT_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const PAYMENT_REQUEST_ERRORS = {
  NOT_FOUND: 'Payment request not found',
  INVOICE_NOT_FOUND: 'Invoice not found',
  NOT_PENDING: 'Only a PENDING payment request can be actioned.',
  // Separate wording from NOT_PENDING: an approved request has a book payment behind it,
  // so "already {status}" tells the user why the button did nothing.
  NOT_PENDING_EDIT: 'Only a PENDING payment request can be edited — this one is already {status}.',
  NOT_PENDING_DELETE:
    'Only a PENDING payment request can be deleted — this one is already {status}.',
  NOTHING_TO_UPDATE: 'Provide at least one field to update.',
};

export const PAYMENT_REQUEST_RESPONSES = {
  CREATED: 'Payment request submitted successfully',
  UPDATED: 'Payment request updated successfully',
  DELETED: 'Payment request deleted successfully',
  APPROVED: 'Payment request approved — book payment created',
  REJECTED: 'Payment request rejected',
};
