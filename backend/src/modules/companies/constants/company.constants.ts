export const COMPANY_ERRORS = {
  NOT_FOUND: 'Company not found',
  NAME_ALREADY_EXISTS: 'Company with this name already exists',
  EMAIL_ALREADY_EXISTS: 'Company with this email already exists',
  GST_ALREADY_EXISTS: 'Company with this GST number already exists',
  INVALID_GST_FORMAT: 'Invalid GST number format. Expected format: 22AAAAA0000A1Z5',
  CANNOT_DELETE_HAS_SITES: 'Cannot delete company with existing sites',
  CANNOT_DELETE_HAS_CHILDREN:
    'Cannot delete company with child companies. Please delete or reassign child companies first.',
  PARENT_NOT_FOUND: 'Parent company not found',
  CANNOT_BE_OWN_PARENT: 'Company cannot be its own parent',
  CIRCULAR_REFERENCE:
    'Circular reference detected. A company cannot be assigned as a child of its own descendant.',
  INVALID_PINCODE: 'Invalid pincode format. Must be 6 digits.',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_CONTACT_NUMBER: 'Invalid contact number format',
};

export const COMPANY_RESPONSES = {
  CREATED: 'Company created successfully',
  UPDATED: 'Company updated successfully',
  DELETED: 'Company deleted successfully',
  RESTORED: 'Company restored successfully',
};

export const COMPANY_FIELD_NAMES = {
  COMPANY: 'Company',
  NAME: 'Company Name',
  LOGO: 'Company Logo',
};

export enum CompanyEntityFields {
  ID = 'id',
  COMPANY = 'Company',
}

// Mapping of sort fields to SQL expressions (for raw queries if needed)
export const COMPANY_SORT_FIELD_MAPPING: Record<string, string> = {
  name: 'c."name"',
  city: 'c."city"',
  state: 'c."state"',
  createdAt: 'c."createdAt"',
  updatedAt: 'c."updatedAt"',
};

export const COMPANY_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 255,
  GST_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PINCODE_REGEX: /^[0-9]{6}$/,
  CONTACT_REGEX: /^[0-9]{10,15}$/,
};
