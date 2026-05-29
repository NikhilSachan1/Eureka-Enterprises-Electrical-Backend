export const SITE_ERRORS = {
  NOT_FOUND: 'Site not found',
  NAME_ALREADY_EXISTS: 'Site with this name already exists',
  COMPANY_NOT_FOUND: 'Company not found',
  CONTRACTOR_NOT_FOUND: 'One or more contractors not found',
  INVALID_DATE_RANGE: 'End date must be after start date',
  CANNOT_DELETE_ACTIVE_SITE: 'Cannot delete an active/ongoing site',
  INVALID_STATUS_TRANSITION: 'Invalid status transition from {from} to {to}',
  AT_LEAST_ONE_CONTRACTOR: 'At least one contractor is required',
  INVALID_WORK_TYPE: 'Invalid work type: {workType}. Available: {available}',
  WORK_TYPES_CONFIG_NOT_FOUND: 'Work types configuration not found',
  SITE_NOT_READY_FOR_CLOSING: 'Site cannot be closed. Financial clearance conditions not met.',
  COMPLETED_REQUIRES_PAST_END_DATE:
    'Site can only be marked as Completed after the end date has passed. Please update the end date first.',
  ONGOING_REQUIRES_STARTED:
    'Site can only be marked as Ongoing after the start date has arrived. Please update the start date first.',
  CANNOT_DELETE_SITE_HAS_DATA:
    'Cannot delete site. Associated data exists: {tables}. Please remove them first.',
  CONTRACTOR_HAS_FINANCIAL_DOCS:
    'Cannot remove contractor — one or more POs / JMCs exist for this contractor on the site. Delete the financial documents first.',
  VENDOR_HAS_FINANCIAL_DOCS:
    'Cannot remove vendor — one or more POs / JMCs exist for this vendor on the site. Delete the financial documents first.',
  ACTIVE_ALLOCATIONS_EXIST:
    'Cannot change site status to {status} — {count} employee(s) are still allocated. Deallocate all employees from the site first.',
};

export const SITE_RESPONSES = {
  CREATED: 'Site created successfully',
  UPDATED: 'Site updated successfully',
  DELETED: 'Site deleted successfully',
  RESTORED: 'Site restored successfully',
  STATUS_UPDATED: 'Site status updated successfully',
  STATUS_HISTORY_FETCHED: 'Site status history fetched successfully',
};

// Status history reasons
export const SITE_STATUS_REASONS = {
  SITE_CREATED: 'Site created',
};

export enum SiteStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  HOLD = 'hold',
  WORK_COMPLETED = 'work_completed',
  COMPLETED = 'completed',
}

export enum SiteEntityFields {
  ID = 'id',
  SITE = 'Site',
}

export const SITE_VALIDATION = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 255,
  PINCODE_REGEX: /^[0-9]{6}$/,
};

// Mapping of sort fields
export const SITE_SORT_FIELD_MAPPING: Record<string, string> = {
  name: 's."name"',
  city: 's."city"',
  state: 's."state"',
  startDate: 's."startDate"',
  endDate: 's."endDate"',
  status: 's."status"',
  createdAt: 's."createdAt"',
  updatedAt: 's."updatedAt"',
};
