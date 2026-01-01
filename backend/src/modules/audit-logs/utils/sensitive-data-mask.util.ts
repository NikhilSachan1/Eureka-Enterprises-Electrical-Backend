import { SENSITIVE_FIELDS, AUDIT_LOG_CONSTANTS } from '../constants/audit-log.constants';

const MASK_VALUE = '[REDACTED]';

export function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  if (typeof data === 'object') {
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveField(key)) {
        masked[key] = MASK_VALUE;
      } else if (typeof value === 'object') {
        masked[key] = maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some((sensitive) => lowerFieldName.includes(sensitive.toLowerCase()));
}

export function truncateBody(
  data: any,
  maxSize: number = AUDIT_LOG_CONSTANTS.MAX_RESPONSE_BODY_SIZE,
): any {
  if (data === null || data === undefined) {
    return data;
  }

  const stringified = JSON.stringify(data);
  if (stringified.length <= maxSize) {
    return data;
  }

  return {
    _truncated: true,
    _originalSize: stringified.length,
    _message: `Body exceeded ${maxSize} bytes and was truncated`,
  };
}

export function extractSafeHeaders(headers: any, allowedHeaders: string[]): Record<string, any> {
  if (!headers) return {};

  const safeHeaders: Record<string, any> = {};
  for (const header of allowedHeaders) {
    const lowerHeader = header.toLowerCase();
    if (headers[lowerHeader]) {
      // Mask authorization header value
      if (lowerHeader === 'authorization') {
        const value = headers[lowerHeader];
        if (typeof value === 'string' && value.length > 20) {
          safeHeaders[lowerHeader] = value.substring(0, 20) + '...[REDACTED]';
        } else {
          safeHeaders[lowerHeader] = MASK_VALUE;
        }
      } else {
        safeHeaders[lowerHeader] = headers[lowerHeader];
      }
    }
  }
  return safeHeaders;
}

export function getChangedFields(oldValues: any, newValues: any): string[] {
  if (!oldValues || !newValues) {
    return Object.keys(newValues || {});
  }

  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changedFields.push(key);
    }
  }

  return changedFields;
}

export function getClientIp(request: any): string {
  return (
    request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.headers?.['x-real-ip'] ||
    request.ip ||
    request.connection?.remoteAddress ||
    'unknown'
  );
}
