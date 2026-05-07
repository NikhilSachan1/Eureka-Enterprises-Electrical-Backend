/**
 * Site Documents Constants - Repurposed for non-financial documents only.
 * 
 * Financial documents (PO, INVOICE) have been moved to dedicated modules:
 * - purchase-orders, site-invoices, bank-transfers, etc.
 * 
 * This module now handles miscellaneous site documents like:
 * - Contracts, work orders, completion certificates
 * - Photos, inspection reports, etc.
 */

export const SITE_DOCUMENT_ERRORS = {
  NOT_FOUND: 'Site document not found',
  SITE_NOT_FOUND: 'Site not found',
  CONTRACTOR_NOT_FOUND: 'Contractor not found',
  VENDOR_NOT_FOUND: 'Vendor not found',
  DOCUMENT_NUMBER_EXISTS: 'Document with this number already exists',
  INVALID_DOCUMENT_TYPE: 'Invalid document type: {type}. Available: {available}',
  INVALID_STATUS: 'Invalid status: {status}. Available: {available}',
  DOCUMENT_TYPE_CONFIG_NOT_FOUND: 'Document types configuration not found',
  STATUS_CONFIG_NOT_FOUND: 'Document statuses configuration not found',
  INVALID_STATUS_TRANSITION: 'Invalid status transition from {from} to {to}',
  FILE_REQUIRED: 'Document file is required',
  FINANCIAL_TYPE_NOT_ALLOWED:
    'Document types PO and INVOICE are no longer allowed. Use the dedicated financial modules (purchase-orders, site-invoices) instead.',
};

export const SITE_DOCUMENT_RESPONSES = {
  CREATED: 'Site document created successfully',
  UPDATED: 'Site document updated successfully',
  DELETED: 'Site document deleted successfully',
  RESTORED: 'Site document restored successfully',
};

/**
 * Allowed document types - non-financial only.
 * PO and INVOICE have been moved to dedicated modules.
 */
export enum SiteDocumentType {
  CONTRACT = 'CONTRACT',
  WORK_ORDER = 'WORK_ORDER',
  COMPLETION_CERTIFICATE = 'COMPLETION_CERTIFICATE',
  PHOTO = 'PHOTO',
  INSPECTION_REPORT = 'INSPECTION_REPORT',
  OTHER = 'OTHER',
}

/**
 * Blocked document types - these are now handled by dedicated financial modules.
 */
export const BLOCKED_FINANCIAL_DOCUMENT_TYPES = ['PO', 'INVOICE'];

/**
 * Simplified document status - removed SUBMITTED and PAID (financial statuses).
 */
export enum SiteDocumentStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum SiteDocumentEntityFields {
  ID = 'id',
  SITE_DOCUMENT = 'Site Document',
}

export const SITE_DOCUMENT_SORT_FIELD_MAPPING: Record<string, string> = {
  documentNumber: 'documentNumber',
  documentDate: 'documentDate',
  amount: 'amount',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

/**
 * Field name to document type mapping for bulk upload.
 * Removed PO and INVOICE.
 */
export const DOCUMENT_TYPE_FIELD_MAPPING: Record<string, string> = {
  contract: 'CONTRACT',
  workOrder: 'WORK_ORDER',
  completionCertificate: 'COMPLETION_CERTIFICATE',
  photo: 'PHOTO',
  inspectionReport: 'INSPECTION_REPORT',
  other: 'OTHER',
};
