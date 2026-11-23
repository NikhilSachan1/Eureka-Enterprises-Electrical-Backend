/** The sync only ever writes into a database whose name ends with this. */
export const DATA_SYNC_TARGET_DB_SUFFIX = '_uat';

/** Copied as structure only — their rows are never brought over from prod. */
export const DATA_SYNC_SKIPPED_DATA_TABLES = [
  'communication_logs',
  'entity_audit_logs',
  'request_audit_logs',
  'cron_logs',
  'notifications',
  'payment_advice_email_logs',
  'refresh_tokens',
  // Push tokens point at real phones; a UAT server must never reach them.
  'user_devices',
] as const;

/** Left exactly as they are in UAT: UAT's schema history must keep matching UAT's schema. */
export const DATA_SYNC_UNTOUCHED_TABLES = ['migrations'] as const;

/** Masked emails keep their name and get this domain. `.test` is reserved: mail never delivers. */
export const DATA_SYNC_EMAIL_DOMAIN = 'uat.test';

/** Temporary objects that exist only inside the sync transaction. */
export const DATA_SYNC_FDW_SERVER = 'data_sync_prod_source';
export const DATA_SYNC_MIRROR_SCHEMA = 'data_sync_prod_mirror';

/** pg advisory lock key, so two syncs never run at once. */
export const DATA_SYNC_LOCK_KEY = 7_420_011;

export const DATA_SYNC_ERRORS = {
  DISABLED: 'Prod → UAT sync is turned off on this server (DATA_SYNC_ENABLED is not true).',
  SOURCE_NOT_CONFIGURED: 'DATA_SYNC_SOURCE_DATABASE is not set.',
  TARGET_NOT_UAT:
    'This server is connected to "{database}". Sync only writes into a database ending with "_uat".',
  SAME_DATABASE: 'Source and target are the same database.',
  ALREADY_RUNNING: 'A sync is already running. Try again in a minute.',
};

export const DATA_SYNC_RESPONSES = {
  COMPLETED: 'Prod data synced into UAT. Everyone has been signed out; please log in again.',
};
