import {
  AssetEventTypes,
  AssetStatus,
} from 'src/modules/asset-masters/constants/asset-masters.constants';

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
  INVALID_STATE_TRANSITION: 'Invalid action: {action} is not allowed when asset status is {status}',
  HANDOVER_ALREADY_PENDING: 'A handover is already pending for this asset',
  NO_HANDOVER_PENDING: 'No handover is pending for this asset',
  ONLY_TARGET_USER_CAN_ACCEPT: 'Only the target user of the handover can accept it',
  ONLY_TARGET_USER_CAN_REJECT: 'Only the target user of the handover can reject it',
  ONLY_INITIATOR_CAN_CANCEL: 'Only the initiator of the handover can cancel it',
};

export const ASSET_EVENTS_SUCCESS_MESSAGES: Record<string, string> = {
  [AssetEventTypes.HANDOVER_INITIATED]: 'Handover initiated successfully',
  [AssetEventTypes.HANDOVER_ACCEPTED]: 'Handover accepted successfully',
  [AssetEventTypes.HANDOVER_REJECTED]: 'Handover rejected successfully',
  [AssetEventTypes.HANDOVER_CANCELLED]: 'Handover cancelled successfully',
  [AssetEventTypes.DEALLOCATED]: 'Asset deallocated successfully',
  [AssetEventTypes.CALIBRATED]: 'Asset calibrated successfully',
  [AssetEventTypes.UNDER_MAINTENANCE]: 'Asset marked under maintenance successfully',
  [AssetEventTypes.DAMAGED]: 'Asset marked as damaged successfully',
  [AssetEventTypes.RETIRED]: 'Asset retired successfully',
  [AssetEventTypes.AVAILABLE]: 'Asset marked as available successfully',
  [AssetEventTypes.ASSIGNED]: 'Asset assigned successfully',
  [AssetEventTypes.ASSET_ADDED]: 'Asset added successfully',
  [AssetEventTypes.UPDATED]: 'Asset updated successfully',
};

export const VALID_ACTIONS_BY_STATUS: Record<string, AssetEventTypes[]> = {
  [AssetStatus.AVAILABLE]: [
    AssetEventTypes.HANDOVER_INITIATED,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
  ],
  [AssetStatus.ASSIGNED]: [
    AssetEventTypes.HANDOVER_INITIATED,
    AssetEventTypes.DEALLOCATED,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
  ],
  [AssetStatus.UNDER_MAINTENANCE]: [
    AssetEventTypes.AVAILABLE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
  ],
  [AssetStatus.DAMAGED]: [
    AssetEventTypes.AVAILABLE,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.RETIRED,
  ],
  [AssetStatus.RETIRED]: [],
};

export const HANDOVER_RESPONSE_ACTIONS = [
  AssetEventTypes.HANDOVER_ACCEPTED,
  AssetEventTypes.HANDOVER_REJECTED,
  AssetEventTypes.HANDOVER_CANCELLED,
];

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
