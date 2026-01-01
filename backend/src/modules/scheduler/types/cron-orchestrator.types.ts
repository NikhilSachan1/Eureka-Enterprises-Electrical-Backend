export interface CronJobResult {
  jobName: string;
  status: 'success' | 'skipped' | 'failed' | 'timeout';
  durationMs: number;
  result?: any;
  error?: string;
}

export interface OrchestratorResult {
  groupName: string;
  totalJobs: number;
  successful: number;
  skipped: number;
  failed: number;
  timedOut: number;
  jobs: CronJobResult[];
  totalDurationMs: number;
}
