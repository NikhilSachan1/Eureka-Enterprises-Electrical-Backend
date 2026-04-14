export enum VehicleLogStatus {
  STARTED = 'STARTED', // Trip started, end entry pending
  COMPLETED = 'COMPLETED', // Trip completed with end entry
}

export const VEHICLE_LOG_ERRORS = {
  NOT_FOUND: 'Vehicle log not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  VEHICLE_NOT_ASSIGNED: 'Vehicle is not currently assigned to any user',
  INVALID_ODOMETER: 'End odometer reading must be greater than or equal to start odometer reading',
  PENDING_LOG_ODOMETER_CONFLICT:
    'Cannot auto-complete the incomplete log from {date} (start: {previousStart} km). Your new reading ({current} km) must be at least {previousStart} km.',
  DUPLICATE_LOG: 'A log already exists for this vehicle on this date',
  START_ODOMETER_PROOF_REQUIRED: 'Start odometer proof (photo) is required',
  END_ODOMETER_PROOF_REQUIRED: 'End odometer proof (photo) is required',
  CANNOT_UPDATE_DELETED: 'Cannot update a deleted vehicle log',
  FUTURE_DATE_NOT_ALLOWED: 'Log date cannot be in the future',
  ANOMALY_THRESHOLD_CONFIG_NOT_FOUND: 'Vehicle log anomaly threshold configuration not found',
  BACKFILL_DAYS_CONFIG_NOT_FOUND: 'Vehicle log backfill days configuration not found',
  EMPLOYEE_CANNOT_SPECIFY_VEHICLE_ID: 'Only HR and Admin can specify vehicleId for other users',
  // Pending log errors
  PENDING_LOGS_EXIST:
    'You have incomplete vehicle logs from previous days. Please complete them first.',
  ALREADY_COMPLETED: 'This vehicle log is already completed',
  LOG_NOT_STARTED: 'Cannot end a log that has not been started',
  // Sequence validation errors
  START_LESS_THAN_PREVIOUS_END:
    'Start odometer ({start}) cannot be less than previous day end odometer ({previousEnd})',
  END_GREATER_THAN_NEXT_START:
    'End odometer ({end}) cannot be greater than next day start odometer ({nextStart})',
  // Backfill errors
  ONLY_HR_ADMIN_CAN_BACKFILL:
    'Only HR and Admin can create logs for past dates beyond allowed period',
};

export const VEHICLE_LOG_RESPONSES = {
  STARTED: 'Vehicle log started successfully',
  COMPLETED: 'Vehicle log completed successfully',
  UPDATED: 'Vehicle log updated successfully',
  DELETED: 'Vehicle log deleted successfully',
  RESTORED: 'Vehicle log restored successfully',
};

// Anomaly reason template with placeholders for dynamic values
// {traveled} - actual KM traveled, {maxAllowed} - threshold limit, {siteName} - site name
// {baseDistance} - site base distance, {threshold} - configured threshold multiplier
export const VEHICLE_LOG_ANOMALY_REASON =
  'Traveled {traveled}km, exceeded max allowed {maxAllowed}km (Site: {siteName}, base distance: {baseDistance}km, threshold: {threshold}x)';

export enum VehicleLogFileType {
  START_ODOMETER = 'START_ODOMETER',
  END_ODOMETER = 'END_ODOMETER',
  OTHER = 'OTHER',
}

export const VEHICLE_LOG_SORTABLE_FIELDS = [
  'logDate',
  'totalKmTraveled',
  'status',
  'createdAt',
  'updatedAt',
];

export const VEHICLE_LOG_FIELD_MAPPING: Record<string, string> = {
  logDate: 'vl."logDate"',
  totalKmTraveled: 'vl."totalKmTraveled"',
  status: 'vl."status"',
  createdAt: 'vl."createdAt"',
  updatedAt: 'vl."updatedAt"',
};
