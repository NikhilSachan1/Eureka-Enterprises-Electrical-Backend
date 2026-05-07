export const JMC_ERRORS = {
  NOT_FOUND: 'JMC not found',
  PO_NOT_FOUND: 'Parent PO not found',
  PO_NOT_APPROVED: 'Parent PO must be approved before creating a JMC',
  JMC_NUMBER_EXISTS: 'JMC number already exists under this PO',
  CANNOT_DELETE_HAS_CHILDREN:
    'Cannot delete JMC — Reports or Invoices exist against it. Delete children first.',
};

export const JMC_RESPONSES = {
  CREATED: 'JMC created successfully',
  UPDATED: 'JMC updated successfully',
  DELETED: 'JMC deleted successfully',
  APPROVED: 'JMC approved',
  REJECTED: 'JMC rejected',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'JMC unlocked',
};

export enum JmcEntityFields {
  ID = 'id',
  JMC = 'JMC',
}
