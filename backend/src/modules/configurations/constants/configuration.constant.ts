export enum ConfigurationValueType {
  JSON = 'json',
  ARRAY = 'array',
  NUMBER = 'number',
  TEXT = 'text',
  BOOLEAN = 'boolean',
}

export const CONFIGURATION_ERRORS = {
  CONFIGURATION_KEY_ALREADY_EXISTS: `Configuration key {{key}} already exists`,
};
