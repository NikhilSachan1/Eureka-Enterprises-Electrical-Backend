export const PO_ERRORS = {
  NOT_FOUND: 'Purchase order not found',
  PO_NUMBER_EXISTS: 'PO number already exists for this site/party combination',
  AMOUNT_VALIDATION_FAILED: 'Total amount must equal taxable + GST amount',
  CONTRACTOR_NOT_FOUND_FOR_SALE:
    'Contractor not found or not linked to this site. Sale-side PO requires a valid contractor.',
  VENDOR_NOT_FOUND_FOR_PURCHASE:
    'Vendor not found or not linked to this site. Purchase-side PO requires a valid vendor.',
  SITE_NOT_FOUND: 'Site not found',
  CANNOT_DELETE_HAS_JMCS:
    'Cannot delete PO — JMCs exist against it. Delete JMCs first.',
  REJECT_REASON_REQUIRED: 'Rejection reason is required.',
  UNLOCK_REASON_REQUIRED: 'Unlock reason is required.',
  ONLY_APPROVED_LOCKED_CAN_UNLOCK:
    'Only APPROVED locked POs can request unlock.',
};

export const PO_RESPONSES = {
  CREATED: 'Purchase order created successfully',
  UPDATED: 'Purchase order updated successfully',
  DELETED: 'Purchase order deleted successfully',
  APPROVED: 'Purchase order approved',
  REJECTED: 'Purchase order rejected',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'Purchase order unlocked',
};

export enum PoEntityFields {
  ID = 'id',
  PO = 'Purchase Order',
}

export const PO_SORT_FIELD_MAPPING: Record<string, string> = {
  poNumber: 'po."poNumber"',
  poDate: 'po."poDate"',
  totalAmount: 'po."totalAmount"',
  approvalStatus: 'po."approvalStatus"',
  createdAt: 'po."createdAt"',
  updatedAt: 'po."updatedAt"',
};
