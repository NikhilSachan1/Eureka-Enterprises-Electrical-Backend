/** Config key holding the advance-number format: { prefix, padLength, startFrom }. */
export const ADVANCE_NUMBER_CONFIG_KEY = 'advance_number_config';

export const ADVANCE_PAYMENT_ERRORS = {
  NOT_FOUND: 'Advance payment not found',
  PO_NOT_FOUND: 'Purchase order not found',
  PO_NOT_PURCHASE: 'Advance payments can only be created against a PURCHASE purchase order.',
  PO_NOT_APPROVED:
    'Advance payments can only be created against an approved purchase order. This PO is {status}.',
  AMOUNT_MUST_BE_POSITIVE: 'Advance amount must be greater than zero.',
  // PO headroom: what is not yet invoiced is what an advance may draw against.
  EXCEEDS_PO_LIMIT:
    'Advance of {requested} exceeds the remaining PO limit. PO total {poTotal}, already invoiced {invoiced}, already advanced {advanced} — {available} available.',
  ALREADY_APPROVED: 'This advance payment is already approved.',
  ALREADY_REJECTED: 'This advance payment is already rejected.',
  NOT_APPROVED_FOR_BOOKING: 'Only an approved advance payment can be booked.',
  // Edit / delete lock
  LOCKED_HAS_BOOK_PAYMENT:
    'This advance payment cannot be changed — a book payment already exists against it.',
  LOCKED_SETTLED:
    'This advance payment cannot be changed — {settled} has already been settled against invoices.',
  REJECT_REASON_REQUIRED: 'Rejection reason is required.',
  SETTLEMENT_EXCEEDS_BALANCE:
    'Cannot settle {requested} against advance {advanceNumber} — only {available} is available.',
};

export const ADVANCE_PAYMENT_RESPONSES = {
  CREATED: 'Advance payment recorded successfully',
  UPDATED: 'Advance payment updated successfully',
  DELETED: 'Advance payment deleted successfully',
  APPROVED: 'Advance payment approved successfully',
  REJECTED: 'Advance payment rejected successfully',
};

export enum AdvancePaymentSortableFields {
  ADVANCE_NUMBER = 'advanceNumber',
  ADVANCE_DATE = 'advanceDate',
  AMOUNT = 'amount',
  CREATED_AT = 'createdAt',
}
