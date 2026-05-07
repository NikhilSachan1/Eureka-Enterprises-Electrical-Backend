export const BOOK_PAYMENT_ERRORS = {
  NOT_FOUND: 'Book payment not found.',
  INVOICE_NOT_FOUND: 'Invoice not found.',
  INVOICE_NOT_APPROVED: 'Invoice must be approved before booking payment.',
  INVOICE_NOT_PURCHASE: 'Book payments can only be created for PURCHASE side invoices.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of booked payments cannot exceed invoice total amount.',
  CANNOT_DELETE_HAS_TRANSFER:
    'Cannot delete book payment — a bank transfer exists. Delete the bank transfer first.',
  AMOUNT_VALIDATION_FAILED:
    'Payment total must equal taxable + gst - tds deduction.',
};

export const BOOK_PAYMENT_RESPONSES = {
  CREATED: 'Book payment created successfully.',
  UPDATED: 'Book payment updated successfully.',
  DELETED: 'Book payment deleted successfully.',
};
