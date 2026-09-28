export const INVOICE_ERRORS = {
  // ── Advance settlement (manual) ───────────────────────────────────────────
  SETTLE_INVOICE_NOT_PURCHASE: 'Advances can only be settled against PURCHASE side invoices.',
  SETTLE_INVOICE_NOT_APPROVED:
    'The invoice must be approved before an advance can be settled against it.',
  SETTLE_ADVANCE_NOT_FOUND: 'Advance payment not found.',
  SETTLE_ADVANCE_NOT_APPROVED: 'The advance payment must be approved before it can be settled.',
  SETTLE_DIFFERENT_PO:
    'This advance belongs to a different purchase order. An advance can only be settled against invoices of its own PO.',
  SETTLE_ADVANCE_FULLY_SETTLED: 'Advance {advanceNumber} is already fully settled.',
  SETTLE_EXCEEDS_ADVANCE_BALANCE:
    'Advance {advanceNumber} has only {balance} left to settle. You entered {requested}.',
  SETTLE_NO_DUE:
    'This invoice has nothing left to settle — its net payable of {netPayable} is already covered by advances and booked payments.',
  SETTLE_EXCEEDS_DUE: 'Only {due} is due on this invoice. You entered {requested}.',
  SETTLEMENT_NOT_FOUND: 'No settlement found to reverse for this invoice.',
  CANNOT_UNLOCK_HAS_SETTLEMENTS:
    'This invoice has {count} advance settlement(s) totalling {amount}. Remove them first — unlocking would let the amount change while the settlement still points at the old figure.',

  NOT_FOUND: 'Invoice not found',
  ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK: 'Only APPROVED locked invoices can request unlock.',
  JMC_NOT_FOUND: 'Parent JMC not found',
  JMC_NOT_APPROVED: 'Parent JMC must be approved before creating an Invoice',
  JMC_NOT_APPROVED_FOR_APPROVAL: 'Cannot approve Invoice — parent JMC must be approved first.',
  REPORT_REQUIRED_FOR_PURCHASE:
    'A Report must exist for this JMC before a PURCHASE-side Invoice can be created (BRD §4.4)',
  INVOICE_ALREADY_EXISTS_FOR_JMC: 'An Invoice already exists for this JMC (1 JMC = 1 Invoice)',
  INVOICE_NUMBER_EXISTS: 'Invoice number already exists',
  AMOUNT_VALIDATION_FAILED: 'Total amount must equal taxable + GST amount',
  CANNOT_DELETE_HAS_CHILDREN: 'Cannot delete invoice — payments / book payments exist against it.',
  PO_CEILING_EXCEEDED_ON_SAVE:
    'Invoice total amount exceeds the remaining PO capacity. Reduce the amount or check other pending/approved invoices on this PO.',
  INVOICE_INCOMPLETE:
    'Invoice is incomplete — invoiceNumber, invoiceDate, amounts, and attachment must all be filled before approving.',
};

export const INVOICE_RESPONSES = {
  CREATED: 'Invoice created successfully',
  UPDATED: 'Invoice updated successfully',
  DELETED: 'Invoice deleted successfully',
  APPROVED: 'Invoice approved',
  REJECTED: 'Invoice rejected',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'Invoice unlocked',
  UNLOCK_REJECTED: 'Unlock request rejected — invoice remains locked',
  ADVANCE_SETTLED: 'Advance settled against the invoice successfully',
  ADVANCE_UNSETTLED: 'Advance settlement reversed successfully',
};
