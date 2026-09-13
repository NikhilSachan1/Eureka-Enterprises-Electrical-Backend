export const BOOK_PAYMENT_ERRORS = {
  NOT_FOUND: 'Book payment not found.',
  CANNOT_UPDATE_HAS_TRANSFER: 'Cannot update book payment — a bank transfer exists.',
  ADVANCE_BACKED_AMOUNT_NOT_EDITABLE:
    'The amount of an advance-backed book payment cannot be edited here. Adjust the advance payment instead.',
  INVOICE_NOT_FOUND: 'Invoice not found.',
  INVOICE_NOT_APPROVED: 'Invoice must be approved before booking payment.',
  INVOICE_NOT_PURCHASE: 'Book payments can only be created for PURCHASE side invoices.',
  INVOICE_CEILING_EXCEEDED:
    'Invoice ceiling exceeded — sum of booked payments cannot exceed invoice net payable amount.',
  // Same rule as INVOICE_CEILING_EXCEEDED, but stating the figures so the user knows what
  // to enter instead of having to work the remainder out themselves.
  INVOICE_CEILING_EXCEEDED_DETAIL:
    'Invoice net payable is {netPayable}. {advance} was already paid as an advance and {booked} is already booked, so you can book at most {remaining}. You entered {requested}.',
  INVOICE_FULLY_BOOKED:
    'Invoice net payable of {netPayable} is already fully covered ({advance} by advance, {booked} booked). No further payment can be booked against it.',
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
  CANNOT_EDIT_APPROVED: 'Cannot edit an approved book payment — it is locked.',
  CANNOT_DELETE_APPROVED: 'Cannot delete an approved book payment — it is locked.',
  ALREADY_APPROVED: 'Book payment is already approved.',
  CANNOT_REJECT_APPROVED: 'Cannot reject an already approved book payment.',
  BOOK_PAYMENT_NOT_APPROVED: 'Book payment must be approved before creating a bank transfer.',
  ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK: 'Only APPROVED locked book payments can request unlock.',
  CANNOT_UNLOCK_HAS_TRANSFER:
    'Cannot unlock — a bank transfer exists against this book payment. Reverse the bank transfer first.',
};

export const GST_HOLD_REMARK =
  'GST component withheld pending vendor compliance verification. The GST amount will be disbursed upon receipt of a compliance certificate or upon verification of return filing status on the GST portal.';

export const BOOK_PAYMENT_RESPONSES = {
  CREATED: 'Book payment created successfully.',
  UPDATED: 'Book payment updated successfully.',
  DELETED: 'Book payment deleted successfully.',
  APPROVED: 'Book payment approved successfully.',
  REJECTED: 'Book payment rejected successfully.',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'Book payment unlocked',
  UNLOCK_REJECTED: 'Unlock request rejected — book payment remains locked',
};

/**
 * What a book payment is raised against. Exactly one of `invoiceId` / `advancePaymentId` is set
 * to match, enforced in the database by CHK_BOOK_PAYMENT_SOURCE.
 *
 * INVOICE is the default so every row that predates advance payments reads correctly — all of them
 * were invoice-backed, since nothing else was possible.
 */
export enum BookPaymentSourceType {
  INVOICE = 'INVOICE',
  ADVANCE = 'ADVANCE',
}
