export const BANK_TRANSFER_ERRORS = {
  NOT_FOUND: 'Bank transfer not found.',
  INVOICE_NOT_FOUND: 'Invoice not found.',
  INVOICE_NOT_APPROVED: 'Invoice must be approved before creating a bank transfer.',
  INVOICE_NOT_SALE_SIDE: 'Invoice must belong to a SALE side for this operation.',
  BOOK_PAYMENT_NOT_FOUND: 'Book payment not found.',
  BOOK_PAYMENT_HAS_TRANSFER: 'This book payment already has a bank transfer (1:1).',
  AMOUNT_MISMATCH_PURCHASE:
    'Bank transfer amount must equal the book payment amount exactly for PURCHASE side.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of bank transfers cannot exceed invoice total amount.',
  INVALID_PARTY_SALE:
    'For SALE side, invoiceId is required and bookPaymentId must be null.',
  INVALID_PARTY_PURCHASE:
    'For PURCHASE side, bookPaymentId is required and invoiceId must be null.',
  CANNOT_DELETE_HAS_ADVICE:
    'Cannot delete bank transfer — a payment advice exists. Delete the payment advice first.',
  CANNOT_CHANGE_AMOUNT_ADVICE_EXISTS:
    'Cannot change transfer amount — a payment advice exists.',
  CANNOT_CHANGE_AMOUNT_PURCHASE:
    'Cannot change transfer amount on PURCHASE side — it must match book payment.',
};

export const BANK_TRANSFER_RESPONSES = {
  CREATED: 'Bank transfer created successfully.',
  UPDATED: 'Bank transfer updated successfully.',
  DELETED: 'Bank transfer deleted successfully.',
};
