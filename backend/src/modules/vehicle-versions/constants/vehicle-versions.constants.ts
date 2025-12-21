export const VEHICLE_VERSION_ERRORS = {
  VEHICLE_ALREADY_EXISTS: 'Vehicle already exists',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  INVALID_ACTION: 'Invalid action',
};

export enum VehicleVersionEntityFields {
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  MILEAGE = 'mileage',
  FUEL_TYPE = 'fuelType',
  PURCHASE_DATE = 'purchaseDate',
  DEALER_NAME = 'dealerName',
  INSURANCE_START_DATE = 'insuranceStartDate',
  INSURANCE_END_DATE = 'insuranceEndDate',
  PUC_START_DATE = 'pucStartDate',
  PUC_END_DATE = 'pucEndDate',
  FITNESS_START_DATE = 'fitnessStartDate',
  FITNESS_END_DATE = 'fitnessEndDate',
  STATUS = 'status',
  ASSIGNED_TO = 'assignedTo',
  REMARKS = 'remarks',
  VEHICLE = 'Vehicle',
}

export enum VehicleVersionSortFields {
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
