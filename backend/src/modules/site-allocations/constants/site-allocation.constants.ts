export const SITE_ALLOCATION_ERRORS = {
  NOT_FOUND: 'Site allocation not found',
  SITE_NOT_FOUND: 'Site not found',
  USER_NOT_FOUND: 'User not found',
  EMPLOYEE_ALREADY_ALLOCATED:
    'Employee is already allocated to another site. Please deallocate first.',
  EMPLOYEE_ALREADY_IN_SITE: 'Employee is already allocated to this site',
  CANNOT_ALLOCATE_TO_INACTIVE_SITE: 'Cannot allocate employee to an inactive or completed site',
  INVALID_ALLOCATION_TYPE: 'Invalid allocation type: {type}. Available: {available}',
  INVALID_SITE_ROLE: 'Invalid site role: {role}. Available: {available}',
  ALLOCATION_TYPES_CONFIG_NOT_FOUND: 'Allocation types configuration not found',
  SITE_ROLES_CONFIG_NOT_FOUND: 'Site roles configuration not found',
  CANNOT_UPDATE_DEALLOCATED: 'Cannot update a deallocated record. Please create a new allocation.',
};

export const SITE_ALLOCATION_RESPONSES = {
  CREATED: 'Employee allocated to site successfully',
  UPDATED: 'Site allocation updated successfully',
  DEALLOCATED: 'Employee deallocated from site successfully',
  RESTORED: 'Site allocation restored successfully',
};

export enum SiteAllocationEntityFields {
  ID = 'id',
  SITE_ALLOCATION = 'Site Allocation',
}

// Default values
export const SITE_ALLOCATION_DEFAULTS = {
  ROLE: 'Engineer',
  DAILY_ALLOWANCE: 0,
  ALLOCATION_TYPE: 'full_time',
};

export const SITE_ALLOCATION_VALIDATION = {
  DAILY_ALLOWANCE_MIN: 0,
  DAILY_ALLOWANCE_MAX: 100000,
};

// Sort field mapping for raw SQL queries
export const SITE_ALLOCATION_SORT_FIELD_MAPPING: Record<string, string> = {
  allocatedAt: 'sa."allocatedAt"',
  deallocatedAt: 'sa."deallocatedAt"',
  role: 'sa."role"',
  allocationType: 'sa."allocationType"',
  dailyAllowance: 'sa."dailyAllowance"',
  createdAt: 'sa."createdAt"',
  updatedAt: 'sa."updatedAt"',
};

export enum AllocationAction {
  ALLOCATE = 'allocate',
  DEALLOCATE = 'deallocate',
}
