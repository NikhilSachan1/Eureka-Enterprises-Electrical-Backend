export const INVOICE_ERRORS = {
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
};
