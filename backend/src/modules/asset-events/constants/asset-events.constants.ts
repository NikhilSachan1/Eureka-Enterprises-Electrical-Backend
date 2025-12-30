export const ASSET_EVENTS_ERRORS = {
  INVALID_ACTION: 'Invalid action',
  INVALID_EVENT_TYPE: 'Invalid event type, Please use the following types:',
  TO_USER_REQUIRED_FOR_HANDOVER: 'Target user (toUserId) is required for handover initiation',
  FILES_REQUIRED_FOR_HANDOVER_INITIATE: 'Files are required for handover initiation',
  FILES_REQUIRED_FOR_HANDOVER_ACCEPT: 'Files are required for handover acceptance',
  FILES_REQUIRED_FOR_CALIBRATION: 'Calibration certificate is required for calibration action',
  ASSET_NOT_ASSIGNED: 'Asset is not currently assigned to any user',
  ASSET_NOT_FOUND: 'Asset not found',
  NO_PENDING_HANDOVER: 'No pending handover found for this asset',
  UNAUTHORIZED_HANDOVER_ACTION: 'You are not authorized to perform this handover action',
};

export enum AssetEventsSortableFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  EVENT_TYPE = 'eventType',
}

export const ASSET_EVENTS_SORT_FIELD_MAPPING: Record<string, string> = {
  createdAt: 'ae."createdAt"',
  updatedAt: 'ae."updatedAt"',
  eventType: 'ae."eventType"',
};
