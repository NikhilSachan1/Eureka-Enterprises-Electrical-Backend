export const SITE_ALLOCATION_ERRORS = {
  NOT_FOUND: 'Site allocation not found',
  SITE_NOT_FOUND: 'Site not found',
  USER_NOT_FOUND: 'User not found',
  EMPLOYEE_ALREADY_ALLOCATED:
    'Employee is already allocated to another site. Please deallocate first.',
  EMPLOYEE_ALREADY_IN_SITE: 'Employee is already allocated to this site',
  CANNOT_ALLOCATE_TO_INACTIVE_SITE: 'Cannot allocate employee to an inactive or completed site',
  SITE_STATUS_BLOCKS_ALLOCATION:
    'Site is currently {status}. Remove all employees from the site before this status can allow changes.',
  INVALID_ALLOCATION_TYPE: 'Invalid allocation type: {type}. Available: {available}',
  INVALID_SITE_ROLE: 'Invalid site role: {role}. Available: {available}',
  ALLOCATION_TYPES_CONFIG_NOT_FOUND: 'Allocation types configuration not found',
  SITE_ROLES_CONFIG_NOT_FOUND: 'Site roles configuration not found',
  CANNOT_UPDATE_DEALLOCATED: 'Cannot update a deallocated record. Please create a new allocation.',

  // ── Date-range clashes ────────────────────────────────────────────────────
  // Replaces the old "already allocated" check, which looked at a flag and so refused a backfill
  // for last August because the employee had a booking for next week.
  DATE_CLASH:
    'This employee is already allocated elsewhere on these dates: {clashes}. ' +
    'Change those dates first, or pick a range that does not overlap.',
  CLASH_WOULD_WORSEN:
    'These dates already clash with {clashes}. The change would make the overlap larger, so it ' +
    'has been stopped. Shrinking the dates is allowed.',
  INVALID_DATE_RANGE: 'The end date cannot be before the start date.',

  // ── Delete ────────────────────────────────────────────────────────────────
  DELETE_PAYROLL_GENERATED:
    'Payroll has already been generated for {months}, which this allocation covers. ' +
    'Deleting it would leave the payslip and the record disagreeing about where this employee was.',
  DELETE_CONFIRM_ATTENDANCE:
    'This employee has {days} attendance day(s) recorded inside these dates. Deleting the ' +
    'allocation leaves those days with no project. Send confirm=true to delete anyway.',
};

export const SITE_ALLOCATION_RESPONSES = {
  CREATED: 'Employee allocated to site successfully',
  UPDATED: 'Site allocation updated successfully',
  DEALLOCATED: 'Employee deallocated from site successfully',
  RESTORED: 'Site allocation restored successfully',
  DELETED: 'Site allocation deleted',
  /** Appended to CREATED when an open-ended allocation had to be closed to make room. */
  PREVIOUS_CLOSED: ' Previous allocation at {siteName} was closed on {date}.',
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
