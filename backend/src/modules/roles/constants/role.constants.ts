export enum Roles {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  DRIVER = 'DRIVER',
}

export const ROLE_ERRORS = {
  NOT_FOUND: 'Role not found',
  ALREADY_EXISTS: 'Role already exists',
} as const;

export const ROLE_FIELD_NAMES = {
  ROLE: 'role',
} as const;
