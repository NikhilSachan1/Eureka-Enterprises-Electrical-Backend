export const CONTRACTOR_ERRORS = {
  NOT_FOUND: 'Contractor not found',
  NAME_ALREADY_EXISTS: 'Contractor with this name already exists',
  EMAIL_ALREADY_EXISTS: 'Contractor with this email already exists',
  GST_ALREADY_EXISTS: 'Contractor with this GST number already exists',
  INVALID_GST_FORMAT: 'Invalid GST number format. Expected format: 22AAAAA0000A1Z5',
  INVALID_PINCODE: 'Invalid pincode format. Must be 6 digits.',
  INVALID_EMAIL: 'Invalid email format',
  INVALID_CONTACT_NUMBER: 'Invalid contact number format',
  INVALID_IFSC: 'Invalid IFSC code format. Expected format: ABCD0123456',
  CANNOT_DELETE_SELF_CONTRACTOR: 'Cannot delete the self contractor (company contractor)',
  CANNOT_DELETE_HAS_SITES: 'Cannot delete contractor. Remove all associated sites before deleting.',
  CONTRACTOR_HAS_PENDING_DOCUMENTS:
    'Contractor has site documents with pending or partial payments. Settle all payments before deleting.',
  CONTRACTOR_HAS_ACTIVE_ASSOCIATIONS:
    'Cannot delete contractor. Resolve the following before deleting: {issues}',
};

export const CONTRACTOR_RESPONSES = {
  CREATED: 'Contractor created successfully',
  UPDATED: 'Contractor updated successfully',
  DELETED: 'Contractor deleted successfully',
  RESTORED: 'Contractor restored successfully',
};

export const CONTRACTOR_FIELD_NAMES = {
  CONTRACTOR: 'Contractor',
  NAME: 'Contractor Name',
};

export enum ContractorEntityFields {
  ID = 'id',
  CONTRACTOR = 'Contractor',
}

// Mapping of sort fields to SQL expressions (for raw queries if needed)
export const CONTRACTOR_SORT_FIELD_MAPPING: Record<string, string> = {
  name: 'c."name"',
  city: 'c."city"',
  state: 'c."state"',
  createdAt: 'c."createdAt"',
  updatedAt: 'c."updatedAt"',
};

export const CONTRACTOR_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 255,
  GST_REGEX: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PINCODE_REGEX: /^[0-9]{6}$/,
  CONTACT_REGEX: /^[0-9]{10,15}$/,
  IFSC_REGEX: /^[A-Z]{4}0[A-Z0-9]{6}$/,
};
