export const USER_ROLE_FIELD_NAMES = {
  USER_ROLE: 'User Role',
} as const;

export const USER_ROLE_ERRORS = {
  ROLE_NOT_FOUND: (roleId: string) => `Role with ID ${roleId} not found`,
  USER_NOT_FOUND: 'User not found',
} as const;
