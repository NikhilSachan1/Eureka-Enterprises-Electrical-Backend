export const SITE_DOCUMENT_ERRORS = {
  NOT_FOUND: 'Site document not found',
  SITE_NOT_FOUND: 'Site not found',
  CONTRACTOR_NOT_FOUND: 'Contractor not found',
  DOCUMENT_NUMBER_EXISTS: 'Document with this number already exists',
  INVALID_DOCUMENT_TYPE: 'Invalid document type: {type}. Available: {available}',
  INVALID_STATUS: 'Invalid status: {status}. Available: {available}',
  INVALID_PAYMENT_STATUS: 'Invalid payment status: {status}. Available: {available}',
  INVALID_DIRECTION: 'Invalid document direction: {direction}. Available: {available}',
  DIRECTION_CONFIG_NOT_FOUND: 'Document directions configuration not found',
  DOCUMENT_TYPE_CONFIG_NOT_FOUND: 'Document types configuration not found',
  STATUS_CONFIG_NOT_FOUND: 'Document statuses configuration not found',
  PAYMENT_STATUS_CONFIG_NOT_FOUND: 'Payment statuses configuration not found',
  INVALID_STATUS_TRANSITION: 'Invalid status transition from {from} to {to}',
  INVALID_PAYMENT_STATUS_TRANSITION: 'Invalid payment status transition from {from} to {to}',
  FILE_REQUIRED: 'Document file is required',
  INVALID_AMOUNT: 'Total amount must equal amount + GST amount',
};

export const SITE_DOCUMENT_RESPONSES = {
  CREATED: 'Site document created successfully',
  UPDATED: 'Site document updated successfully',
  DELETED: 'Site document deleted successfully',
  RESTORED: 'Site document restored successfully',
};

// Default values for seeding (will be config-driven)
export enum SiteDocumentType {
  PO = 'PO',
  INVOICE = 'INVOICE',
  CONTRACT = 'CONTRACT',
  WORK_ORDER = 'WORK_ORDER',
  COMPLETION_CERTIFICATE = 'COMPLETION_CERTIFICATE',
  OTHER = 'OTHER',
}

export enum SiteDocumentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

export enum SiteDocumentPaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

// Document direction for profitability calculation
export enum SiteDocumentDirection {
  PAYABLE = 'PAYABLE', // Expense - we pay (to contractors/vendors)
  RECEIVABLE = 'RECEIVABLE', // Income - we receive (from clients)
}

export enum SiteDocumentEntityFields {
  ID = 'id',
  SITE_DOCUMENT = 'Site Document',
}

export const SITE_DOCUMENT_SORT_FIELD_MAPPING: Record<string, string> = {
  documentNumber: 'documentNumber',
  documentDate: 'documentDate',
  amount: 'amount',
  totalAmount: 'totalAmount',
  status: 'status',
  paymentStatus: 'paymentStatus',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

// Field name to document type mapping for bulk upload
export const DOCUMENT_TYPE_FIELD_MAPPING: Record<string, string> = {
  po: 'PO',
  invoice: 'INVOICE',
  contract: 'CONTRACT',
  workOrder: 'WORK_ORDER',
  completionCertificate: 'COMPLETION_CERTIFICATE',
  other: 'OTHER',
};
