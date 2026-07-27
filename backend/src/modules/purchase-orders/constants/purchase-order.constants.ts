export const PO_ERRORS = {
  NOT_FOUND: 'Purchase order not found',
  PO_NUMBER_EXISTS: 'PO number already exists for this site/party combination',
  AMOUNT_VALIDATION_FAILED: 'Total amount must equal taxable + GST amount',
  CONTRACTOR_NOT_FOUND_FOR_SALE:
    'Contractor not found or not linked to this site. Sale-side PO requires a valid contractor.',
  VENDOR_NOT_FOUND_FOR_PURCHASE:
    'Vendor not found or not linked to this site. Purchase-side PO requires a valid vendor.',
  SITE_NOT_FOUND: 'Site not found',
  CANNOT_DELETE_HAS_JMCS: 'Cannot delete PO — JMCs exist against it. Delete JMCs first.',
  REJECT_REASON_REQUIRED: 'Rejection reason is required.',
  UNLOCK_REASON_REQUIRED: 'Unlock reason is required.',
  ONLY_APPROVED_LOCKED_CAN_UNLOCK: 'Only APPROVED locked POs can request unlock.',
  ITEMS_ONLY_FOR_PURCHASE: 'Line items (system-generated PO) are for PURCHASE (vendor) only.',
  UPLOAD_FLOW_FIELDS_REQUIRED:
    'poNumber, taxableAmount, totalAmount and file are required for an upload-based PO.',
  PDF_ONLY_SYSTEM_GENERATED: 'PDF is available only for system-generated POs with items.',
  NOT_ALLOCATED_TO_SITE: 'You are not allocated to this site.',
  CIVIL_PO_ONLY_PM: 'Civil site: only the site Project Manager can create a PO.',
};

export const PROJECT_MANAGER_SITE_ROLE = 'Project Manager';

export const PO_RESPONSES = {
  CREATED: 'Purchase order created successfully',
  UPDATED: 'Purchase order updated successfully',
  DELETED: 'Purchase order deleted successfully',
  APPROVED: 'Purchase order approved',
  REJECTED: 'Purchase order rejected',
  UNLOCK_REQUESTED: 'Unlock request submitted',
  UNLOCK_GRANTED: 'Purchase order unlocked',
  UNLOCK_REJECTED: 'Unlock request rejected — document remains locked',
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
