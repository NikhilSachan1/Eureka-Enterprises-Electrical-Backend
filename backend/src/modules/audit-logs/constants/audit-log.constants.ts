export const AUDIT_LOG_CONSTANTS = {
  DEFAULT_RETENTION_DAYS: 90,
  MAX_RESPONSE_BODY_SIZE: 100000, // 100KB max for response body
  MAX_REQUEST_BODY_SIZE: 100000, // 100KB max for request body
};

export const AUDIT_LOG_ERRORS = {
  NOT_FOUND: 'Audit log not found',
  INVALID_DAYS: 'Days parameter must be a positive number',
  CLEANUP_FAILED: 'Failed to cleanup audit logs',
};

export const AUDIT_LOG_RESPONSES = {
  CLEANUP_SUCCESS:
    'Successfully deleted {requestCount} request logs and {entityCount} entity logs older than {days} days',
  NO_LOGS_TO_DELETE: 'No audit logs found older than {days} days',
};

// Fields to mask in audit logs (case-insensitive)
export const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'apiKey',
  'secret',
  'secretKey',
  'privateKey',
  'creditCard',
  'cardNumber',
  'cvv',
  'ssn',
  'pin',
];

// Endpoints to exclude from request audit logging
export const EXCLUDED_ENDPOINTS = ['/health', '/metrics', '/favicon.ico'];

// Entities to exclude from entity audit logging
export const EXCLUDED_ENTITIES = ['RequestAuditLogEntity', 'EntityAuditLogEntity', 'CronLogEntity'];

// Headers to capture in request logs
export const CAPTURED_HEADERS = [
  'content-type',
  'accept',
  'accept-language',
  'origin',
  'referer',
  'x-forwarded-for',
  'x-real-ip',
];
