export const ASSET_VERSION_ERRORS = {
  ASSET_ALREADY_EXISTS: 'Asset already exists',
  ASSET_NOT_FOUND: 'Asset not found',
  INVALID_ACTION: 'Invalid action',
};

export enum AssetVersionEntityFields {
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  CATEGORY = 'category',
  ASSET = 'Asset',
}

export enum AssetVersionSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DELETED_AT = 'deletedAt',
  NUMBER = 'number',
  BRAND = 'brand',
  MODEL = 'model',
  CATEGORY = 'category',
}
