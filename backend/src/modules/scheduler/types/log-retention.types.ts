export interface LogRetentionTableResult {
  table: string;
  retentionDays: number;
  cutoff: string;
  /** How many rows were older than the cutoff when the run started. */
  eligible: number;
  deleted: number;
  batches: number;
  /** True when the per-run batch ceiling stopped it before the table was fully trimmed. */
  moreRemaining: boolean;
  durationMs: number;
  error?: string;
}

export interface LogRetentionResult {
  enabled: boolean;
  dryRun: boolean;
  totalDeleted: number;
  tables: LogRetentionTableResult[];
  /** Config keys that are not in the code's allow-list, so were ignored. */
  ignoredTables: string[];
}
