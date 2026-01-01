export const VEHICLE_MASTERS_ERRORS = {
  VEHICLE_ALREADY_EXISTS: 'Vehicle with this registration number already exists',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  INVALID_ACTION: 'Invalid action',
  INVALID_DATE_RANGE: 'End date must be after start date',
  ASSIGNED_USER_NOT_FOUND: 'Assigned user not found',
};

export enum VehicleMasterEntityFields {
  REGISTRATION_NO = 'registrationNo',
  VEHICLE = 'Vehicle',
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  DAMAGED = 'DAMAGED',
  RETIRED = 'RETIRED',
}

export enum VehicleFuelType {
  PETROL = 'PETROL',
  DIESEL = 'DIESEL',
  CNG = 'CNG',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID',
}

export enum VehicleFileTypes {
  RC = 'RC',
  INSURANCE = 'INSURANCE',
  PUC = 'PUC',
  FITNESS = 'FITNESS',
  PERMIT = 'PERMIT',
  INVOICE = 'INVOICE',
  SERVICE_BILL = 'SERVICE_BILL',
  VEHICLE_IMAGE = 'VEHICLE_IMAGE',
  OTHER = 'OTHER',
}

export enum VehicleEventTypes {
  VEHICLE_ADDED = 'VEHICLE_ADDED',
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  DEALLOCATED = 'DEALLOCATED',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  DAMAGED = 'DAMAGED',
  RETIRED = 'RETIRED',
  UPDATED = 'UPDATED',
  HANDOVER_INITIATED = 'HANDOVER_INITIATED',
  HANDOVER_ACCEPTED = 'HANDOVER_ACCEPTED',
  HANDOVER_REJECTED = 'HANDOVER_REJECTED',
  HANDOVER_CANCELLED = 'HANDOVER_CANCELLED',
}

export enum DocumentStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum ServiceDueStatus {
  OK = 'OK',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
}

export enum VehicleMasterSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DELETED_AT = 'deletedAt',
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  MILEAGE = 'mileage',
  FUEL_TYPE = 'fuelType',
  STATUS = 'status',
  PURCHASE_DATE = 'purchaseDate',
  INSURANCE_END_DATE = 'insuranceEndDate',
  PUC_END_DATE = 'pucEndDate',
  FITNESS_END_DATE = 'fitnessEndDate',
}

export const DEFAULT_EXPIRING_SOON_DAYS = 30;
