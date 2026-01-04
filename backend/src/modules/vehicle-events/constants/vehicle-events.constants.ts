import {
  VehicleEventTypes,
  VehicleStatus,
} from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

export const VEHICLE_EVENTS_ERRORS = {
  INVALID_ACTION: 'Invalid action',
  INVALID_EVENT_TYPE: 'Invalid event type, Please use the following types:',
  TO_USER_REQUIRED_FOR_HANDOVER: 'Target user (toUserId) is required for handover initiation',
  FILES_REQUIRED_FOR_HANDOVER_INITIATE: 'Files are required for handover initiation',
  FILES_REQUIRED_FOR_HANDOVER_ACCEPT: 'Files are required for handover acceptance',
  VEHICLE_NOT_ASSIGNED: 'Vehicle is not currently assigned to any user',
  VEHICLE_NOT_FOUND: 'Vehicle not found',
  NO_PENDING_HANDOVER: 'No pending handover found for this vehicle',
  UNAUTHORIZED_HANDOVER_ACTION: 'You are not authorized to perform this handover action',
  INVALID_STATE_TRANSITION:
    'Invalid action: {action} is not allowed when vehicle status is {status}',
  HANDOVER_ALREADY_PENDING: 'A handover is already pending for this vehicle',
  NO_HANDOVER_PENDING: 'No handover is pending for this vehicle',
  ONLY_TARGET_USER_CAN_ACCEPT: 'Only the target user of the handover can accept it',
  ONLY_TARGET_USER_CAN_REJECT: 'Only the target user of the handover can reject it',
  ONLY_INITIATOR_CAN_CANCEL: 'Only the initiator of the handover can cancel it',
};

export const VEHICLE_EVENTS_DTO_ERRORS = {
  INVALID_EVENT_TYPES: 'Invalid event type(s). Please choose from the following: {eventTypes}',
  INVALID_SORT_FIELD: 'Invalid sort field. Please choose from the following: {sortFields}',
};

export const VALID_ACTIONS_BY_STATUS: Record<string, VehicleEventTypes[]> = {
  [VehicleStatus.AVAILABLE]: [
    VehicleEventTypes.HANDOVER_INITIATED,
    VehicleEventTypes.UNDER_MAINTENANCE,
    VehicleEventTypes.DAMAGED,
    VehicleEventTypes.RETIRED,
  ],
  [VehicleStatus.ASSIGNED]: [
    VehicleEventTypes.HANDOVER_INITIATED,
    VehicleEventTypes.DEALLOCATED,
    VehicleEventTypes.UNDER_MAINTENANCE,
    VehicleEventTypes.DAMAGED,
    VehicleEventTypes.RETIRED,
  ],
  [VehicleStatus.UNDER_MAINTENANCE]: [
    VehicleEventTypes.AVAILABLE,
    VehicleEventTypes.DAMAGED,
    VehicleEventTypes.RETIRED,
  ],
  [VehicleStatus.DAMAGED]: [
    VehicleEventTypes.AVAILABLE,
    VehicleEventTypes.UNDER_MAINTENANCE,
    VehicleEventTypes.RETIRED,
  ],
  [VehicleStatus.RETIRED]: [],
};

export const HANDOVER_RESPONSE_ACTIONS = [
  VehicleEventTypes.HANDOVER_ACCEPTED,
  VehicleEventTypes.HANDOVER_REJECTED,
  VehicleEventTypes.HANDOVER_CANCELLED,
];

export const VEHICLE_EVENTS_SUCCESS_MESSAGES: Record<string, string> = {
  [VehicleEventTypes.HANDOVER_INITIATED]: 'Handover initiated successfully',
  [VehicleEventTypes.HANDOVER_ACCEPTED]: 'Handover accepted successfully',
  [VehicleEventTypes.HANDOVER_REJECTED]: 'Handover rejected successfully',
  [VehicleEventTypes.HANDOVER_CANCELLED]: 'Handover cancelled successfully',
  [VehicleEventTypes.DEALLOCATED]: 'Vehicle deallocated successfully',
  [VehicleEventTypes.UNDER_MAINTENANCE]: 'Vehicle marked under maintenance successfully',
  [VehicleEventTypes.DAMAGED]: 'Vehicle marked as damaged successfully',
  [VehicleEventTypes.RETIRED]: 'Vehicle retired successfully',
  [VehicleEventTypes.AVAILABLE]: 'Vehicle marked as available successfully',
  [VehicleEventTypes.ASSIGNED]: 'Vehicle assigned successfully',
  [VehicleEventTypes.VEHICLE_ADDED]: 'Vehicle added successfully',
  [VehicleEventTypes.UPDATED]: 'Vehicle updated successfully',
};

export enum VehicleEventsSortableFields {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  EVENT_TYPE = 'eventType',
}

export const VEHICLE_EVENTS_SORT_FIELD_MAPPING: Record<string, string> = {
  createdAt: 've."createdAt"',
  updatedAt: 've."updatedAt"',
  eventType: 've."eventType"',
};
