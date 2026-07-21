export const JMC_ERRORS = {
  NOT_FOUND: 'JMC not found',
  ONLY_APPROVED_LOCKED_CAN_REQUEST_UNLOCK: 'Only APPROVED locked JMCs can request unlock.',
  PO_NOT_FOUND: 'Parent PO not found',
  PO_NOT_APPROVED: 'Parent PO must be approved before creating a JMC',
  PO_NOT_APPROVED_FOR_APPROVAL: 'Cannot approve JMC — parent PO must be approved first.',
  JMC_NUMBER_EXISTS: 'JMC number already exists under this PO',
  CANNOT_DELETE_HAS_CHILDREN:
    'Cannot delete JMC — Reports or Invoices exist against it. Delete children first.',
  ITEMS_ONLY_FOR_SALE: 'Line items can only be added to SALE (contractor) JMCs.',
  UPLOAD_REQUIRED_FOR_APPROVAL: 'Signed JMC upload is required before approval.',
  PDF_ONLY_SYSTEM_GENERATED: 'PDF is available only for system-generated (SALE) JMCs with items.',
};

export const JMC_RESPONSES = {
  CREATED: 'JMC created successfully',
  UPDATED: 'JMC updated successfully',
  UPLOADED: 'JMC signed copy uploaded successfully',
  DELETED: 'JMC deleted successfully',
  APPROVED: 'JMC approved',
  REJECTED: 'JMC rejected',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'JMC unlocked',
  UNLOCK_REJECTED: 'Unlock request rejected — JMC remains locked',
};

export enum JmcEntityFields {
  ID = 'id',
  JMC = 'JMC',
}
