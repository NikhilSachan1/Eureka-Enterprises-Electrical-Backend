export const USER_PERMISSION_ERRORS = {
  NOT_FOUND: 'User permission override not found',
  ALREADY_EXISTS: 'User permission override already exists',
  USER_NOT_FOUND: 'User not found',
  PERMISSION_NOT_FOUND: 'Permission not found',
  INVALID_GRANT_STATUS: 'isGranted must be a boolean value',
  SKIPPED: 'Permission were not updated because they do not exist for this user',
  CANNOT_SPECIFY_FIELDS: 'fields userId, permissionId, isGranted can only be specified for a role',
} as const;

export const USER_PERMISSION_SUCCESS_MESSAGES = {
  DELETED: 'User permission override deleted successfully',
  UPDATED: 'User permission overrides updated successfully',
} as const;

export enum PermissionSource {
  ROLE = 'role',
  OVERRIDE = 'override',
}

export enum UserPermissionStatsSortFields {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  EMAIL = 'email',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  ROLE_PERMISSIONS_COUNT = 'role_permissions_count',
  USER_PERMISSIONS_COUNT = 'user_permissions_count',
  TOTAL_PERMISSIONS = 'total_permissions',
}
