export const USER_PERMISSION_ERRORS = {
  NOT_FOUND: 'User permission override not found',
  USER_NOT_FOUND: 'User not found',
  PERMISSION_NOT_FOUND: 'Permission not found',
  INVALID_GRANT_STATUS: 'isGranted must be a boolean value',
} as const;

export const USER_PERMISSION_SUCCESS_MESSAGES = {
  DELETED: 'User permission override deleted successfully',
} as const;

export enum PermissionSource {
  ROLE = 'role',
  OVERRIDE = 'override',
}
