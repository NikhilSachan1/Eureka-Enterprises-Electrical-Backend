import { Injectable } from '@nestjs/common';

/**
 * DateTimeService - Centralized timezone-aware date/time utilities
 *
 * Industry Standard Approach:
 * - All dates stored in UTC in database
 * - All date comparisons use user's timezone
 * - Timezone priority: Request Header → User Profile → Default (IST)
 *
 * Usage:
 * - Use these methods for ALL date comparisons in the application
 * - Never use `new Date()` directly for "today" comparisons
 */
@Injectable()
export class DateTimeService {
  private readonly DEFAULT_TIMEZONE = 'Asia/Kolkata';

  getDefaultTimezone(): string {
    return this.DEFAULT_TIMEZONE;
  }

  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  getSafeTimezone(timezone?: string): string {
    if (!timezone) return this.DEFAULT_TIMEZONE;
    return this.isValidTimezone(timezone) ? timezone : this.DEFAULT_TIMEZONE;
  }

  /**
   * Get today's date as YYYY-MM-DD string in given timezone
   *
   * @param timezone - IANA timezone string (e.g., 'Asia/Kolkata', 'America/New_York')
   * @returns Date string in YYYY-MM-DD format
   *
   * @example
   * // At 01:15 AM IST on Dec 30th
   * getTodayString('Asia/Kolkata')  // Returns '2025-12-30'
   * getTodayString('UTC')            // Returns '2025-12-29' (still Dec 29th in UTC)
   */
  getTodayString(timezone?: string): string {
    const tz = this.getSafeTimezone(timezone);
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  }

  getNowInTimezone(timezone?: string): Date {
    const tz = this.getSafeTimezone(timezone);
    return new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  }

  /**
   * Get start of today (00:00:00) in given timezone
   *
   * @param timezone - IANA timezone string
   * @returns Date object representing start of today in timezone
   */
  getStartOfToday(timezone?: string): Date {
    const now = this.getNowInTimezone(timezone);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Get end of today (23:59:59.999) in given timezone
   *
   * @param timezone - IANA timezone string
   * @returns Date object representing end of today in timezone
   */
  getEndOfToday(timezone?: string): Date {
    const now = this.getNowInTimezone(timezone);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  /**
   * Check if a date string is in the future relative to timezone
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timezone - IANA timezone string
   * @returns true if dateStr is after today in the given timezone
   *
   * @example
   * // At 01:15 AM IST on Dec 30th
   * isFutureDate('2025-12-30', 'Asia/Kolkata')  // false (it's today)
   * isFutureDate('2025-12-30', 'UTC')           // true (still Dec 29th in UTC)
   */
  isFutureDate(dateStr: string, timezone?: string): boolean {
    const today = this.getTodayString(timezone);
    return dateStr > today;
  }

  /**
   * Check if a date string is today in given timezone
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timezone - IANA timezone string
   * @returns true if dateStr equals today in the given timezone
   */
  isToday(dateStr: string, timezone?: string): boolean {
    const today = this.getTodayString(timezone);
    return dateStr === today;
  }

  /**
   * Check if a date string is in the past relative to timezone
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timezone - IANA timezone string
   * @returns true if dateStr is before today in the given timezone
   */
  isPastDate(dateStr: string, timezone?: string): boolean {
    const today = this.getTodayString(timezone);
    return dateStr < today;
  }

  /**
   * Check if a date string is today or in the past
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timezone - IANA timezone string
   * @returns true if dateStr is today or before in the given timezone
   */
  isTodayOrPast(dateStr: string, timezone?: string): boolean {
    const today = this.getTodayString(timezone);
    return dateStr <= today;
  }

  /**
   * Check if a date string is today or in the future
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @param timezone - IANA timezone string
   * @returns true if dateStr is today or after in the given timezone
   */
  isTodayOrFuture(dateStr: string, timezone?: string): boolean {
    const today = this.getTodayString(timezone);
    return dateStr >= today;
  }

  /**
   * Convert a Date object to YYYY-MM-DD string
   *
   * @param date - Date object
   * @returns Date string in YYYY-MM-DD format
   */
  toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Convert a date string to Date object (start of day in local timezone)
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Date object
   */
  toDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Get the difference in days between two dates
   *
   * @param dateStr1 - First date string (YYYY-MM-DD)
   * @param dateStr2 - Second date string (YYYY-MM-DD)
   * @returns Number of days (positive if dateStr1 > dateStr2)
   */
  getDaysDifference(dateStr1: string, dateStr2: string): number {
    const date1 = this.toDate(dateStr1);
    const date2 = this.toDate(dateStr2);
    const diffMs = date1.getTime() - date2.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days until a future date from today
   *
   * @param dateStr - Future date string (YYYY-MM-DD)
   * @param timezone - IANA timezone string
   * @returns Number of days until the date (negative if past)
   */
  getDaysUntil(dateStr: string, timezone?: string): number {
    const today = this.getTodayString(timezone);
    return this.getDaysDifference(dateStr, today);
  }

  /**
   * Get days since a past date from today
   *
   * @param dateStr - Past date string (YYYY-MM-DD)
   * @param timezone - IANA timezone string
   * @returns Number of days since the date (negative if future)
   */
  getDaysSince(dateStr: string, timezone?: string): number {
    const today = this.getTodayString(timezone);
    return this.getDaysDifference(today, dateStr);
  }
}
