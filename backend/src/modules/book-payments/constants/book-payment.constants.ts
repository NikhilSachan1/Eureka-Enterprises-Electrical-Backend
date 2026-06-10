export const BOOK_PAYMENT_ERRORS = {
  NOT_FOUND: 'Book payment not found.',
  CANNOT_UPDATE_HAS_TRANSFER: 'Cannot update book payment — a bank transfer exists.',
  INVOICE_NOT_FOUND: 'Invoice not found.',
  INVOICE_NOT_APPROVED: 'Invoice must be approved before booking payment.',
  INVOICE_NOT_PURCHASE: 'Book payments can only be created for PURCHASE side invoices.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of booked payments cannot exceed invoice net payable amount.',
  CANNOT_DELETE_HAS_TRANSFER:
    'Cannot delete book payment — a bank transfer exists. Delete the bank transfer first.',
  CANNOT_UPDATE_TDS_PAID:
    'Cannot update — TDS payment has already been released against this book payment.',
  CANNOT_DELETE_TDS_PAID:
    'Cannot delete — TDS payment has already been released against this book payment.',
  AMOUNT_VALIDATION_FAILED: 'Payment total amount must be greater than zero.',
  PAYMENT_HOLD_REASON_REQUIRED:
    'paymentHoldReason is required when paymentHoldAmount is greater than 0.',
  PAYMENT_HOLD_EXCEEDS_TOTAL:
    'paymentHoldAmount must be less than paymentTotalAmount — at least ₹1 must be transferred.',
};

export const GST_HOLD_REMARK =
  'GST component withheld pending vendor compliance verification. The GST amount will be disbursed upon receipt of a compliance certificate or upon verification of return filing status on the GST portal.';

export const BOOK_PAYMENT_RESPONSES = {
  CREATED: 'Book payment created successfully.',
  UPDATED: 'Book payment updated successfully.',
  DELETED: 'Book payment deleted successfully.',
};
