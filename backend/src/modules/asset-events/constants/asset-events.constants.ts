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
  REQUEST_ALREADY_PENDING: 'A handover or return is already pending for this asset',
  NO_RETURN_PENDING: 'No return to office is pending for this asset',
  FILES_REQUIRED_FOR_RETURN_INITIATE: 'Files are required to return an asset to the office',
  ONLY_ASSIGNEE_CAN_RETURN: 'Only the user the asset is assigned to can return it to the office',
  ONLY_INITIATOR_CAN_CANCEL_RETURN: 'Only the user who started the return can cancel it',
  CANNOT_RESPOND_TO_OWN_RETURN: 'You cannot accept or reject a return you started yourself',
  RETURN_PERMISSION_REQUIRED: 'You do not have permission to {action} this return',
};

/** Who may answer a pending return. Checked in the service, as the action endpoint has no guard. */
export const RETURN_RESPONSE_PERMISSIONS: Partial<Record<AssetEventTypes, string>> = {
  [AssetEventTypes.RETURN_ACCEPTED]: 'asset.return-accepted',
  [AssetEventTypes.RETURN_REJECTED]: 'asset.return-rejected',
};

export const ASSET_EVENTS_SUCCESS_MESSAGES: Record<string, string> = {
  [AssetEventTypes.HANDOVER_INITIATED]: 'Handover initiated successfully',
  [AssetEventTypes.HANDOVER_ACCEPTED]: 'Handover accepted successfully',
  [AssetEventTypes.HANDOVER_REJECTED]: 'Handover rejected successfully',
  [AssetEventTypes.HANDOVER_CANCELLED]: 'Handover cancelled successfully',
  [AssetEventTypes.RETURN_INITIATED]: 'Return to office initiated successfully',
  [AssetEventTypes.RETURN_ACCEPTED]: 'Return accepted successfully. The asset is available again',
  [AssetEventTypes.RETURN_REJECTED]: 'Return rejected successfully',
  [AssetEventTypes.RETURN_CANCELLED]: 'Return cancelled successfully',
  [AssetEventTypes.DEALLOCATED]: 'Asset deallocated successfully',
  [AssetEventTypes.CALIBRATED]: 'Asset calibrated successfully',
  [AssetEventTypes.UNDER_MAINTENANCE]: 'Asset marked under maintenance successfully',
  [AssetEventTypes.DAMAGED]: 'Asset marked as damaged successfully',
  [AssetEventTypes.RETIRED]: 'Asset retired successfully',
  [AssetEventTypes.AVAILABLE]: 'Asset marked as available successfully',
  [AssetEventTypes.ASSIGNED]: 'Asset assigned successfully',
  [AssetEventTypes.ASSET_ADDED]: 'Asset added successfully',
  [AssetEventTypes.UPDATED]: 'Asset updated successfully',
  [AssetEventTypes.LOST]: 'Asset marked as lost successfully',
  [AssetEventTypes.RECOVERED]: 'Asset marked as recovered successfully',
};

export const VALID_ACTIONS_BY_STATUS: Record<string, AssetEventTypes[]> = {
  [AssetStatus.AVAILABLE]: [
    AssetEventTypes.HANDOVER_INITIATED,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
    AssetEventTypes.LOST,
  ],
  [AssetStatus.ASSIGNED]: [
    AssetEventTypes.HANDOVER_INITIATED,
    AssetEventTypes.RETURN_INITIATED,
    AssetEventTypes.DEALLOCATED,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
    AssetEventTypes.LOST,
  ],
  [AssetStatus.UNDER_MAINTENANCE]: [
    AssetEventTypes.AVAILABLE,
    AssetEventTypes.DAMAGED,
    AssetEventTypes.RETIRED,
    AssetEventTypes.CALIBRATED,
    AssetEventTypes.LOST,
  ],
  [AssetStatus.DAMAGED]: [
    AssetEventTypes.AVAILABLE,
    AssetEventTypes.UNDER_MAINTENANCE,
    AssetEventTypes.RETIRED,
    AssetEventTypes.LOST,
  ],
  [AssetStatus.RETIRED]: [],
  [AssetStatus.LOST]: [AssetEventTypes.RECOVERED],
};

export const HANDOVER_RESPONSE_ACTIONS = [
  AssetEventTypes.HANDOVER_ACCEPTED,
  AssetEventTypes.HANDOVER_REJECTED,
  AssetEventTypes.HANDOVER_CANCELLED,
];

export const RETURN_RESPONSE_ACTIONS = [
  AssetEventTypes.RETURN_ACCEPTED,
  AssetEventTypes.RETURN_REJECTED,
  AssetEventTypes.RETURN_CANCELLED,
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
