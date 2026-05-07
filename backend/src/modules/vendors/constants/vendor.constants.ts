export const VENDOR_ERRORS = {
  NOT_FOUND: 'Vendor not found',
  NAME_ALREADY_EXISTS: 'Vendor with this name already exists',
  EMAIL_ALREADY_EXISTS: 'Vendor with this email already exists',
  GST_ALREADY_EXISTS: 'Vendor with this GST number already exists',
  GST_REQUIRED_FOR_REGISTERED:
    'GST number is required when vendorType is GST_REGISTERED',
  GST_NOT_ALLOWED_FOR_FREELANCER:
    'GST number is not allowed when vendorType is FREELANCER',
  INVALID_GST_FORMAT: 'Invalid GST number format. Expected format: 22AAAAA0000A1Z5',
  INVALID_PAN_FORMAT: 'Invalid PAN number format. Expected format: ABCDE1234F',
  INVALID_PINCODE: 'Invalid pincode format. Must be 6 digits.',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_CONTACT_NUMBER: 'Invalid contact number format',
  INVALID_IFSC: 'Invalid IFSC code format. Expected format: ABCD0123456',
  INVALID_VENDOR_TYPE: 'Invalid vendor type. Allowed: FREELANCER, GST_REGISTERED',
  CANNOT_DELETE_HAS_SITES:
    'Cannot delete vendor. Remove all associated sites before deleting.',
  VENDOR_HAS_PENDING_FINANCIALS:
    'Vendor has pending financial documents (POs, JMCs, Invoices, Book Payments). Settle them before deleting.',
  VENDOR_HAS_ACTIVE_ASSOCIATIONS:
    'Cannot delete vendor. Resolve the following before deleting: {issues}',
};

export const VENDOR_RESPONSES = {
  CREATED: 'Vendor created successfully',
  UPDATED: 'Vendor updated successfully',
  DELETED: 'Vendor deleted successfully',
  RESTORED: 'Vendor restored successfully',
};

export const VENDOR_FIELD_NAMES = {
  VENDOR: 'Vendor',
  NAME: 'Vendor Name',
};

export enum VendorEntityFields {
  ID = 'id',
  VENDOR = 'Vendor',
}

export enum VendorType {
  FREELANCER = 'FREELANCER',
  GST_REGISTERED = 'GST_REGISTERED',
}

// Mapping of sort fields to SQL expressions (for raw queries if needed)
export const VENDOR_SORT_FIELD_MAPPING: Record<string, string> = {
  name: 'v."name"',
  city: 'v."city"',
  state: 'v."state"',
  vendorType: 'v."vendorType"',
  createdAt: 'v."createdAt"',
  updatedAt: 'v."updatedAt"',
};

export const VENDOR_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 255,
  GST_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PAN_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  PINCODE_REGEX: /^[0-9]{6}$/,
  CONTACT_REGEX: /^[0-9]{10,15}$/,
  IFSC_REGEX: /^[A-Z]{4}0[A-Z0-9]{6}$/,
};
