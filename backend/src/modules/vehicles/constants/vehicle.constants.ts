export const VEHICLE_ERRORS = {
  VEHICLE_ALREADY_EXISTS: 'Vehicle already exists',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  INVALID_ACTION: 'Invalid action',
};

export enum VehicleEntityFields {
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  MILEAGE = 'mileage',
  VEHICLE = 'Vehicle',
}

export const DEFAULT_VEHICLE_FILE_TYPES = {
  VEHICLE_IMAGE_DOC: 'vehicle_image_doc',
};

//TODO: These vehicle event types need to be seed in database
export enum VehicleEventTypes {
  VEHICLE_ADDED = 'vehicle_added',
  AVAILABLE = 'available',
  DEALLOCATED = 'deallocated',
  MAINTENANCE = 'maintenance',
  HANDOVER_INITIATED = 'handover_initiated',
  HANDOVER_ACCEPTED = 'handover_accepted',
  HANDOVER_REJECTED = 'handover_rejected',
  HANDOVER_CANCELLED = 'handover_cancelled',
}
