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
  NOT_EDITABLE: 'Role is not editable',
  NOT_DELETABLE: 'Role is not deletable',
} as const;

export const ROLE_FIELD_NAMES = {
  ROLE: 'Role',
} as const;
