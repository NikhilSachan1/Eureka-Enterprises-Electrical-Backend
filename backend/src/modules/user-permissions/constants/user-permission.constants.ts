export const USER_PERMISSION_ERRORS = {
  NOT_FOUND: 'User permission override not found',
  USER_NOT_FOUND: 'User not found',
  PERMISSION_NOT_FOUND: 'Permission not found',
  INVALID_GRANT_STATUS: 'isGranted must be a boolean value',
  SKIPPED: 'Permission were not updated because they do not exist for this user',
} as const;

export const USER_PERMISSION_SUCCESS_MESSAGES = {
  DELETED: 'User permission override deleted successfully',
  UPDATED: 'User permission overrides updated successfully',
} as const;

export enum PermissionSource {
  ROLE = 'role',
  OVERRIDE = 'override',
}
