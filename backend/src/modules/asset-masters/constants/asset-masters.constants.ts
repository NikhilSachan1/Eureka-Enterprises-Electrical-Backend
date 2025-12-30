export const ASSET_MASTERS_ERRORS = {
  ASSET_ALREADY_EXISTS: 'Asset with this ID already exists',
  ASSET_NOT_FOUND: 'Asset not found',
  ASSET_ALREADY_DELETED: 'Asset is already deleted',
  ASSET_CANNOT_DELETE_ASSIGNED:
    'Cannot delete asset with status: {status}. Only available assets can be deleted',
  INVALID_ACTION: 'Invalid action',
  INVALID_ASSET_TYPE: 'Invalid asset type',
  INVALID_CATEGORY: 'Invalid category',
  INVALID_CALIBRATION_FROM: 'Invalid calibration source',
  INVALID_CALIBRATION_FREQUENCY: 'Invalid calibration frequency',
  INVALID_STATUS: 'Invalid asset status',
  CALIBRATION_DATES_REQUIRED: 'Calibration dates are required for calibrated assets',
  CALIBRATION_NOT_ALLOWED_FOR_NON_CALIBRATED:
    'Calibration dates are not allowed for non-calibrated assets',
  CALIBRATION_END_BEFORE_START: 'Calibration end date must be after start date',
  WARRANTY_END_BEFORE_START: 'Warranty end date must be after start date',
  ASSIGNED_USER_NOT_FOUND: 'Assigned user not found',
};

export const ASSET_MASTERS_SUCCESS_MESSAGES = {
  ASSET_DELETE_PROCESSED:
    'Bulk delete processed: {length} assets requested, {success} deleted successfully, {error} failed',
  ASSET_DELETE_SUCCESS: 'Asset deleted successfully',
};

export enum AssetMasterEntityFields {
  ASSET_ID = 'assetId',
  ASSET = 'Asset',
}

export enum AssetFileTypes {
  ASSET_IMAGE = 'ASSET_IMAGE',
  CALIBRATION_CERTIFICATE = 'CALIBRATION_CERTIFICATE',
  WARRANTY_DOCUMENT = 'WARRANTY_DOCUMENT',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  AMC = 'AMC',
  REPAIR_REPORT = 'REPAIR_REPORT',
  OTHER = 'OTHER',
}

export enum AssetType {
  CALIBRATED = 'CALIBRATED',
  NON_CALIBRATED = 'NON_CALIBRATED',
}

export enum AssetStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  DAMAGED = 'DAMAGED',
  RETIRED = 'RETIRED',
}

export enum CalibrationStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
}

export enum WarrantyStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  UNDER_WARRANTY = 'UNDER_WARRANTY',
  EXPIRING_SOON = 'EXPIRING_SOON',
  EXPIRED = 'EXPIRED',
}

export enum AssetEventTypes {
  ASSET_ADDED = 'ASSET_ADDED',
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  DEALLOCATED = 'DEALLOCATED',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  CALIBRATED = 'CALIBRATED',
  DAMAGED = 'DAMAGED',
  RETIRED = 'RETIRED',
  UPDATED = 'UPDATED',
  HANDOVER_INITIATED = 'HANDOVER_INITIATED',
  HANDOVER_ACCEPTED = 'HANDOVER_ACCEPTED',
  HANDOVER_REJECTED = 'HANDOVER_REJECTED',
  HANDOVER_CANCELLED = 'HANDOVER_CANCELLED',
}

export enum AssetMasterSortFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  NAME = 'name',
  MODEL = 'model',
  CATEGORY = 'category',
  ASSET_TYPE = 'assetType',
  STATUS = 'status',
  CALIBRATION_END_DATE = 'calibrationEndDate',
  WARRANTY_END_DATE = 'warrantyEndDate',
  PURCHASE_DATE = 'purchaseDate',
}

export const ASSET_SORT_FIELD_MAPPING: Record<string, string> = {
  createdAt: 'am."createdAt"',
  updatedAt: 'am."updatedAt"',
  name: 'av."name"',
  model: 'av."model"',
  category: 'av."category"',
  assetType: 'av."assetType"',
  status: 'av."status"',
  calibrationEndDate: 'av."calibrationEndDate"',
  warrantyEndDate: 'av."warrantyEndDate"',
  purchaseDate: 'av."purchaseDate"',
};

export const EXPIRING_SOON_DAYS = 30;
