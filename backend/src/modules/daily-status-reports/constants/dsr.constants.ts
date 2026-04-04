// Default DSR status for auto-approval
export const DSR_DEFAULT_STATUS = 'APPROVED';

// Entity field names for responses
export const DsrEntityFields = {
  DSR: 'Daily Status Report',
  DSR_FILE: 'DSR File',
};

// Error messages
export const DSR_ERRORS = {
  NOT_FOUND: 'Daily Status Report not found',
  ALREADY_EXISTS: 'DSR already exists for this site and date',
  SITE_NOT_ALLOCATED: 'Site is not allocated to the user',
  SITE_NOT_ACTIVE: 'Site must be in upcoming or ongoing status',
  INVALID_WORK_TYPE: 'Invalid work type: {type}. Available types: {available}',
  INVALID_WEATHER_CONDITION: 'Invalid weather condition: {condition}. Available: {available}',
  EQUIPMENT_NOT_ALLOCATED: 'Equipment with ID {assetId} is not allocated to the user',
  EDIT_CUTOFF_EXCEEDED: 'DSR cannot be edited after {duration} from creation',
  WEATHER_CONFIG_NOT_FOUND: 'Weather condition configuration not found',
  SHIFT_CONFIG_NOT_FOUND: 'Shift configuration not found',
  FILE_NOT_FOUND: 'DSR file not found',
  FORCE_TARGET_USER_FORBIDDEN:
    'Only SUPER_ADMIN, HR, ADMIN, or MANAGER can create a forced DSR for another user',
};

// Success messages
export const DSR_RESPONSES = {
  RESTORED: 'Daily Status Report restored successfully',
  FILE_DELETED: 'DSR file deleted successfully',
};

// Default values
export const DSR_DEFAULTS = {
  HOURS_WORKED: 8, // Will be overridden by shift config
  PROGRESS_PERCENTAGE: 0,
};
