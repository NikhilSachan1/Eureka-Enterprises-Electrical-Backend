import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CRON_NAMES, CRON_SCHEDULES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import {
  LOG_RETENTION_DEFAULTS,
  LogRetentionConfig,
  MIN_RETENTION_DAYS,
  RETAINABLE_LOG_TABLES,
  RETAINABLE_LOG_TABLE_NAMES,
  RetainableLogTable,
} from '../constants/log-retention.constants';
import { LogRetentionResult, LogRetentionTableResult } from '../types/log-retention.types';

@Injectable()
export class LogRetentionCronService {
  private readonly logger = new Logger(LogRetentionCronService.name);

  constructor(
    private readonly cronLogService: CronLogService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON: Log retention cleanup
   *
   * Trims the five write-only log tables to their configured window. They are ~95% of the database
   * and nothing reads them back through the application.
   *
   * Runs at 2:00 AM IST, behind the `log_retention` config, which ships disabled.
   */
  @Cron(CRON_SCHEDULES.DAILY_2AM_IST)
  async handleLogRetentionCleanup(): Promise<LogRetentionResult | null> {
    return this.cronLogService.execute(
      CRON_NAMES.LOG_RETENTION_CLEANUP,
      CronJobType.CLEANUP,
      async () => this.run(false),
    );
  }

  /**
   * Counts what a real run would remove, deleting nothing. This is what the manual trigger's
   * `dryRun` calls — worth having when the thing on the other side of the switch is ~2 GB of
   * irreversible deletes.
   */
  async previewLogRetentionCleanup(): Promise<LogRetentionResult> {
    return this.run(true);
  }

  private async run(dryRun: boolean): Promise<LogRetentionResult> {
    const cronName = CRON_NAMES.LOG_RETENTION_CLEANUP;
    const config = await this.getConfig();

    const result: LogRetentionResult = {
      enabled: config.enabled,
      dryRun,
      totalDeleted: 0,
      tables: [],
      ignoredTables: Object.keys(config.tables).filter(
        (t) => !RETAINABLE_LOG_TABLE_NAMES.includes(t as RetainableLogTable),
      ),
    };

    if (result.ignoredTables.length > 0) {
      // Loud rather than silent: someone expecting a table to be trimmed should find out why not.
      this.logger.warn(
        `[${cronName}] Ignoring table(s) not in the allow-list: ${result.ignoredTables.join(', ')}`,
      );
    }

    // The kill switch. A preview is allowed to run while disabled — that is the point of it.
    if (!config.enabled && !dryRun) {
      this.logger.log(`[${cronName}] Disabled by config — nothing deleted.`);
      return result;
    }

    for (const table of RETAINABLE_LOG_TABLE_NAMES) {
      result.tables.push(await this.trimTable(table, config, dryRun, cronName));
    }

    result.totalDeleted = result.tables.reduce((sum, t) => sum + t.deleted, 0);
    return result;
  }

  private async trimTable(
    table: RetainableLogTable,
    config: LogRetentionConfig,
    dryRun: boolean,
    cronName: string,
  ): Promise<LogRetentionTableResult> {
    const startedAt = Date.now();
    const { dateColumn, defaultDays } = RETAINABLE_LOG_TABLES[table];
    const retentionDays = this.resolveDays(config.tables[table], defaultDays, table);

    const row: LogRetentionTableResult = {
      table,
      retentionDays,
      cutoff: `NOW() - ${retentionDays} days`,
      eligible: 0,
      deleted: 0,
      batches: 0,
      moreRemaining: false,
      durationMs: 0,
    };

    try {
      const [{ n }] = await this.dataSource.query(
        `SELECT count(*)::int AS n FROM "${table}"
          WHERE "${dateColumn}" < NOW() - ($1 || ' days')::interval`,
        [String(retentionDays)],
      );
      row.eligible = n;

      if (n === 0 || dryRun) {
        row.moreRemaining = dryRun && n > 0;
        row.durationMs = Date.now() - startedAt;
        return row;
      }

      // Deleted by ctid in capped batches rather than one statement: a single DELETE of 450k rows
      // holds locks and bloats WAL for minutes, and this table is still being written to while we
      // run. Each batch is its own short transaction.
      while (row.batches < config.maxBatchesPerTable) {
        const deleted = await this.dataSource.query(
          `DELETE FROM "${table}"
            WHERE ctid IN (
              SELECT ctid FROM "${table}"
               WHERE "${dateColumn}" < NOW() - ($1 || ' days')::interval
               LIMIT ${config.batchSize}
            )`,
          [String(retentionDays)],
        );
        const count = Array.isArray(deleted) ? deleted[1] ?? 0 : 0;
        row.batches += 1;
        row.deleted += count;
        if (count < config.batchSize) break;
      }

      row.moreRemaining = row.deleted < row.eligible;
      this.logger.log(
        `[${cronName}] ${table}: removed ${row.deleted} of ${row.eligible} rows older than ` +
          `${retentionDays} days in ${row.batches} batch(es)` +
          `${row.moreRemaining ? ' — rest continues tomorrow' : ''}`,
      );
    } catch (error) {
      // One table failing must not stop the others.
      row.error = (error as Error).message;
      this.logger.error(`[${cronName}] ${table} failed: ${row.error}`);
    }

    row.durationMs = Date.now() - startedAt;
    return row;
  }

  /** A missing, non-numeric or too-small value falls back to the code default rather than deleting more. */
  private resolveDays(configured: unknown, fallback: number, table: string): number {
    const days = Number(configured);
    if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS) {
      if (configured !== undefined) {
        this.logger.warn(
          `[${CRON_NAMES.LOG_RETENTION_CLEANUP}] ${table}: retention "${configured}" is not usable ` +
            `(minimum ${MIN_RETENTION_DAYS}); falling back to ${fallback} days.`,
        );
      }
      return fallback;
    }
    return Math.floor(days);
  }

  /** Missing or unreadable config means disabled, with the code defaults for everything else. */
  private async getConfig(): Promise<LogRetentionConfig> {
    const fallback: LogRetentionConfig = { ...LOG_RETENTION_DEFAULTS, tables: {} };
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.SYSTEM,
          key: CONFIGURATION_KEYS.LOG_RETENTION,
        },
      });
      if (!configuration) return fallback;

      const setting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });
      const value = setting?.value as Partial<LogRetentionConfig> | undefined;
      if (!value) return fallback;

      const batchSize = Number(value.batchSize);
      const maxBatches = Number(value.maxBatchesPerTable);

      return {
        enabled: value.enabled === true,
        batchSize:
          Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : fallback.batchSize,
        maxBatchesPerTable:
          Number.isFinite(maxBatches) && maxBatches > 0
            ? Math.floor(maxBatches)
            : fallback.maxBatchesPerTable,
        tables: value.tables ?? {},
      };
    } catch (error) {
      this.logger.warn(
        `[${CRON_NAMES.LOG_RETENTION_CLEANUP}] Config unreadable, staying disabled: ${
          (error as Error).message
        }`,
      );
      return fallback;
    }
  }
}
