export const BOOK_PAYMENT_ERRORS = {
  NOT_FOUND: 'Book payment not found.',
  CANNOT_UPDATE_HAS_TRANSFER: 'Cannot update book payment — a bank transfer exists.',
  INVOICE_NOT_FOUND: 'Invoice not found.',
  INVOICE_NOT_APPROVED: 'Invoice must be approved before booking payment.',
  INVOICE_NOT_PURCHASE: 'Book payments can only be created for PURCHASE side invoices.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of booked payments cannot exceed invoice total amount.',
  CANNOT_DELETE_HAS_TRANSFER:
    'Cannot delete book payment — a bank transfer exists. Delete the bank transfer first.',
  CANNOT_UPDATE_TDS_PAID:
    'Cannot update — TDS payment has already been released against this book payment.',
  CANNOT_DELETE_TDS_PAID:
    'Cannot delete — TDS payment has already been released against this book payment.',
  AMOUNT_VALIDATION_FAILED: 'Payment total must equal taxable + gst - tds deduction.',
};

export const BOOK_PAYMENT_RESPONSES = {
  CREATED: 'Book payment created successfully.',
  UPDATED: 'Book payment updated successfully.',
  DELETED: 'Book payment deleted successfully.',
};
