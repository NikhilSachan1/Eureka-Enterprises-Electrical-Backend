export const ASSET_MASTERS_ERRORS = {
  ASSET_ALREADY_EXISTS: 'Asset with this registration number already exists',
  ASSET_NOT_FOUND: 'Asset not found',
  INVALID_ACTION: 'Invalid action',
};

export enum AssetMasterEntityFields {
  REGISTRATION_NO = 'registrationNo',
  ASSET = 'Asset',
}

export const DEFAULT_ASSET_FILE_TYPES = {
  ASSET_IMAGE_DOC: 'asset_image_doc',
};

//TODO: These asset event types need to be seed in database
export enum AssetEventTypes {
  ASSET_ADDED = 'asset_added',
  AVAILABLE = 'available',
  DEALLOCATED = 'deallocated',
  MAINTENANCE = 'maintenance',
  HANDOVER_INITIATED = 'handover_initiated',
  HANDOVER_ACCEPTED = 'handover_accepted',
  HANDOVER_REJECTED = 'handover_rejected',
  HANDOVER_CANCELLED = 'handover_cancelled',
}

export enum AssetMasterSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DELETED_AT = 'deletedAt',
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  CATEGORY = 'category',
}
