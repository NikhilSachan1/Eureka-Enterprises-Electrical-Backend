/**
 * Shared `@Transform` helpers for DTOs.
 *
 * Free functions rather than UtilityService methods: property decorators run at
 * class-definition time, outside the Nest container, so they cannot resolve an
 * injectable.
 */

/**
 * Parses a multipart form field that carries a JSON array.
 *
 * Multipart text fields always arrive as strings, so the array has to be parsed
 * before class-validator sees it. Anything that is not parseable is returned
 * untouched so `@IsArray` reports it, rather than this transform swallowing the
 * error.
 */
export function parseJsonArray({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
