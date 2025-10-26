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
}

// export const DEFAULT_VEHICLE_FILE_TYPES = {
//   VEHICLE_IMAGE_DOC: 'vehicle_image_doc',
// };

// //TODO: These vehicle event types need to be seed in database
// export enum VehicleEventTypes {
//   VEHICLE_ADDED = 'vehicle_added',
//   AVAILABLE = 'available',
//   DEALLOCATED = 'deallocated',
//   MAINTENANCE = 'maintenance',
//   HANDOVER_INITIATED = 'handover_initiated',
//   HANDOVER_ACCEPTED = 'handover_accepted',
//   HANDOVER_REJECTED = 'handover_rejected',
//   HANDOVER_CANCELLED = 'handover_cancelled',
// }
