/**
 * Analytics DTOs - Barrel Export
 *
 * All analytics request DTOs are exported from here for easy importing.
 * Each DTO is in its own file for better organization and maintainability.
 */

// Base DTO with common fields
export * from './base-analytics.dto';

// Executive Dashboard
export * from './dashboard.dto';

// Site Analytics
export * from './site-profitability.dto';
export * from './site-health.dto';
export * from './site-timeline.dto';

// Invoice Aging
export * from './invoice-aging.dto';

// Contractor Analytics
export * from './contractor-analytics.dto';

// Employee Analytics
export * from './employee-analytics.dto';

// Vehicle/Fleet Analytics
export * from './vehicle-analytics.dto';
