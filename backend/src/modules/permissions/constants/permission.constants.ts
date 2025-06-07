export const PERMISSION_ERRORS = {
  NOT_FOUND: 'Permission not found',
  ALREADY_EXISTS: (name: string) => `Permission with name '${name}' already exists`,
  INVALID_NAME: 'Permission name must be unique and follow naming convention',
  INVALID_MODULE: 'Module name is required',
  INVALID_MODULE_NOT_IN_CONFIG: (module: string, config: string) =>
    `Module '${module}' is not configured in config settings. Please add module configuration first. ${config}`,
} as const;
