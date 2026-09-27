/**
 * Log retention cleanup.
 *
 * Five tables are pure logs: nothing in the application reads them back, they only grow. On dev
 * they account for roughly 95% of the whole database, so they are trimmed on a schedule.
 */

/**
 * The tables this cron is allowed to touch, and the column it dates them by.
 *
 * **This list lives in code on purpose.** The config can only change how many days each of these is
 * kept — it cannot add a table. A table name coming from a config row would end up interpolated
 * into a DELETE, and one typo (`"users": 7`) would be unrecoverable. Anything in the config that is
 * not in this list is ignored and reported.
 */
export const RETAINABLE_LOG_TABLES = {
  communication_logs: { dateColumn: 'createdAt', defaultDays: 15 },
  request_audit_logs: { dateColumn: 'createdAt', defaultDays: 7 },
  entity_audit_logs: { dateColumn: 'createdAt', defaultDays: 7 },
  /**
   * Only `POST /admin/cron/trigger` reads this table, for its "has this already run for this
   * period?" and dependency checks; the scheduled jobs never read it, and each of them has its own
   * data-level guard anyway (payroll refuses a month it already has, attendance skips existing
   * rows). So this window only decides how far back a *manual* re-trigger is still warned about.
   * 90 days covers a full quarter of manual re-runs, on a table under 2 MB.
   */
  cron_logs: { dateColumn: 'createdAt', defaultDays: 90 },
  /** Proof that a payment advice was emailed. */
  payment_advice_email_logs: { dateColumn: 'createdAt', defaultDays: 60 },
} as const;

export type RetainableLogTable = keyof typeof RETAINABLE_LOG_TABLES;

export const RETAINABLE_LOG_TABLE_NAMES = Object.keys(
  RETAINABLE_LOG_TABLES,
) as RetainableLogTable[];

/**
 * Used when the config row is missing or unreadable. `enabled: false` is deliberate: a cleanup that
 * starts deleting because a config row went missing is the worst possible failure mode here.
 */
export const LOG_RETENTION_DEFAULTS = {
  enabled: false,
  /** Rows per DELETE. Small enough to keep locks short on a table with hundreds of thousands. */
  batchSize: 5000,
  /**
   * Ceiling per table per run. The first run after switching this on has ~450k rows to clear on
   * two of the tables; this spreads that over a few nights instead of one long delete storm.
   */
  maxBatchesPerTable: 40,
};

/** Nothing below this is accepted from config — a 0-day retention would empty a table. */
export const MIN_RETENTION_DAYS = 2;

export interface LogRetentionConfig {
  enabled: boolean;
  batchSize: number;
  maxBatchesPerTable: number;
  tables: Record<string, number>;
}
