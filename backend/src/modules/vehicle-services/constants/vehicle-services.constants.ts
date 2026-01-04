export const VEHICLE_SERVICES_ERRORS = {
  SERVICE_NOT_FOUND: 'Vehicle service not found',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  INVALID_ODOMETER: 'Odometer reading cannot be less than last recorded reading',
  INVALID_SERVICE_DATE: 'Service date cannot be in the future',
  SERVICE_ALREADY_DELETED: 'Vehicle service has already been deleted',
};

export const VEHICLE_SERVICES_SUCCESS = {
  SERVICE_CREATED: 'Vehicle service created successfully',
  SERVICE_UPDATED: 'Vehicle service updated successfully',
  SERVICE_DELETED: 'Vehicle service deleted successfully',
  BULK_DELETE_PROCESSED:
    'Bulk delete processed: {length} requested, {success} deleted successfully, {error} failed',
};

export enum VehicleServiceType {
  REGULAR_SERVICE = 'REGULAR_SERVICE',
  EMERGENCY_SERVICE = 'EMERGENCY_SERVICE',
  BREAKDOWN_REPAIR = 'BREAKDOWN_REPAIR',
  ACCIDENT_REPAIR = 'ACCIDENT_REPAIR',
  TYRE_CHANGE = 'TYRE_CHANGE',
  BATTERY_REPLACEMENT = 'BATTERY_REPLACEMENT',
  OTHER = 'OTHER',
}

export enum VehicleServiceStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED',
}

export enum VehicleServiceFileType {
  INVOICE = 'INVOICE',
  BILL = 'BILL',
  REPAIR_REPORT = 'REPAIR_REPORT',
  WARRANTY_CARD = 'WARRANTY_CARD',
  OTHER = 'OTHER',
}

export const SERVICE_TYPES_RESET_INTERVAL = [
  VehicleServiceType.REGULAR_SERVICE,
  VehicleServiceType.EMERGENCY_SERVICE,
];

export enum ServiceDueStatus {
  OK = 'OK',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
}

export enum VehicleServiceSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  SERVICE_DATE = 'serviceDate',
  ODOMETER_READING = 'odometerReading',
  SERVICE_COST = 'serviceCost',
}

export enum VehicleServiceEntityFields {
  VEHICLE_MASTER_ID = 'vehicleMasterId',
  SERVICE_DATE = 'serviceDate',
  ODOMETER_READING = 'odometerReading',
  SERVICE_TYPE = 'serviceType',
  SERVICE_DETAILS = 'serviceDetails',
  SERVICE_CENTER_NAME = 'serviceCenterName',
  SERVICE_COST = 'serviceCost',
  SERVICE_STATUS = 'serviceStatus',
  RESERVATION_STATUS = 'reservationStatus',
  VEHICLE_SERVICE = 'Vehicle Service',
}
