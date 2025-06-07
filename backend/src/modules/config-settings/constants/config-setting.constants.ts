export enum ValueType {
  JSON = 'json',
  ARRAY = 'array',
  NUMBER = 'number',
  TEXT = 'text',
  BOOLEAN = 'boolean',
}

export const CONFIG_SETTING_ERRORS = {
  NOT_FOUND: 'Config setting not found',
  CONFIG_NOT_FOUND: 'Configuration not found',
  INVALID_VALUE_TYPE: (configKey: string, expectedType: string, receivedType: string) =>
    `Invalid value for configuration '${configKey}'. Expected ${expectedType}, got ${receivedType}`,
  UNSUPPORTED_VALUE_TYPE: (valueType: string, configKey: string) =>
    `Unsupported value type '${valueType}' for configuration '${configKey}'`,
  SETTING_NOT_FOUND_FOR_KEY: (configKey: string, contextKey?: string) =>
    `Config setting not found for key '${configKey}'${
      contextKey ? ` and context '${contextKey}'` : ''
    }`,
  VALUE_REQUIRED: 'Config value cannot be null or undefined',
  INVALID_JSON_OBJECT: 'Expected JSON object (not array or primitive)',
  INVALID_NUMBER: 'Expected valid number',
  ACTIVE_SETTING_NOT_FOUND: (configKey: string, contextKey?: string) =>
    `No active config setting found for key '${configKey}'${
      contextKey ? ` and context '${contextKey}'` : ''
    }`,
} as const;

export const CONFIG_SETTING_RESPONSES = {
  CREATED: 'Config setting created successfully',
  UPDATED: 'Config setting updated successfully',
  DELETED: 'Config setting deleted successfully',
  RETRIEVED: 'Config setting retrieved successfully',
} as const;

export const VALUE_TYPE_DESCRIPTIONS = {
  [ValueType.JSON]: 'JSON object',
  [ValueType.ARRAY]: 'array',
  [ValueType.NUMBER]: 'number',
  [ValueType.TEXT]: 'string',
  [ValueType.BOOLEAN]: 'boolean',
} as const;
