export interface DataSyncStatus {
  /** True only when the sync flag is on and this server is connected to a *_uat database. */
  available: boolean;
  /** Why the sync cannot run here; null when it can. */
  reason: string | null;
  sourceDatabase: string | null;
  targetDatabase: string;
  /** Tables whose rows are never copied from prod. */
  skippedTables: string[];
}

export interface SyncTableRow {
  tableName: string;
  /** Quoted, schema-qualified UAT table. */
  targetTable: string;
  /** Quoted mirror of the prod table. */
  sourceTable: string;
  /** Quoted column list both sides share; null when prod has no such table. */
  columns: string | null;
}
