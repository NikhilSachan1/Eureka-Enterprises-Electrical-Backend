import { VehicleEventTypes } from 'src/modules/vehicle-masters/constants/vehicle-masters.constants';

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
};

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
