export enum Roles {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR = 'HR',
  DRIVER = 'DRIVER',
}

export const ROLE_ERRORS = {
  NOT_FOUND: 'Role not found',
} as const;
