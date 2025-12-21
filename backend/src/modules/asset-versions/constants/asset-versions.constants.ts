export const ASSET_VERSION_ERRORS = {
  ASSET_VERSION_NOT_FOUND: 'Asset version not found',
  INVALID_ACTION: 'Invalid action',
};

export enum AssetVersionEntityFields {
  NAME = 'name',
  MODEL = 'model',
  CATEGORY = 'category',
  ASSET_TYPE = 'assetType',
  ASSET_VERSION = 'Asset Version',
}

export enum AssetVersionSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  MODEL = 'model',
  CATEGORY = 'category',
  ASSET_TYPE = 'assetType',
  STATUS = 'status',
}
