import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CronLogRepository } from './cron-log.repository';
import { CronLogEntity } from './entities/cron-log.entity';
import {
  CronJobStatus,
  CronJobType,
  CronTriggerType,
  CRON_LOG_ERRORS,
  DEFAULT_CRON_LOG_RETENTION_DAYS,
  CRON_LOG_RESPONSES,
} from './constants/cron-log.constants';
import { CronLogQueryDto } from './dto';
import {
  buildCronLogListQuery,
  buildCronLogStatsQuery,
  buildRecentFailuresQuery,
} from './queries/cron-log.queries';

@Injectable()
export class CronLogService {
  private readonly logger = new Logger(CronLogService.name);

  constructor(private readonly cronLogRepository: CronLogRepository) {}

  async start(
    jobName: string,
    jobType: CronJobType,
    triggeredBy: CronTriggerType = CronTriggerType.SYSTEM,
    createdBy?: string,
  ): Promise<CronLogEntity> {
    const log = await this.cronLogRepository.create({
      jobName,
      jobType,
      status: CronJobStatus.RUNNING,
      startedAt: new Date(),
      triggeredBy,
      createdBy,
    });

    this.logger.log(`[${jobName}] Started - Log ID: ${log.id}`);
    return log;
  }

  async success(logId: string, result?: Record<string, any>): Promise<void> {
    const log = await this.findOneOrFail(logId);

    if (log.status !== CronJobStatus.RUNNING) {
      this.logger.warn(`[${log.jobName}] Already completed with status: ${log.status}`);
      return;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - log.startedAt.getTime();

    await this.cronLogRepository.update(logId, {
      status: CronJobStatus.SUCCESS,
      completedAt,
      durationMs,
      result,
    });

    this.logger.log(
      `[${log.jobName}] Completed successfully in ${durationMs}ms - Result: ${JSON.stringify(
        result,
      )}`,
    );
  }

  async fail(logId: string, error: Error | string): Promise<void> {
    const log = await this.findOneOrFail(logId);

    if (log.status !== CronJobStatus.RUNNING) {
      this.logger.warn(`[${log.jobName}] Already completed with status: ${log.status}`);
      return;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - log.startedAt.getTime();
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    await this.cronLogRepository.update(logId, {
      status: CronJobStatus.FAILED,
      completedAt,
      durationMs,
      errorMessage,
      errorStack,
    });

    this.logger.error(`[${log.jobName}] Failed after ${durationMs}ms - Error: ${errorMessage}`);

    // TODO: Send email notification for failed cron jobs
    // await this.emailService.sendCronFailureNotification({
    //   jobName: log.jobName,
    //   jobType: log.jobType,
    //   errorMessage,
    //   errorStack,
    //   startedAt: log.startedAt,
    //   failedAt: completedAt,
    //   durationMs,
    // });
  }

  async execute<T>(
    jobName: string,
    jobType: CronJobType,
    fn: () => Promise<T>,
    triggeredBy: CronTriggerType = CronTriggerType.SYSTEM,
    createdBy?: string,
  ): Promise<T | null> {
    const log = await this.start(jobName, jobType, triggeredBy, createdBy);

    try {
      const result = await fn();
      await this.success(log.id, result as Record<string, any>);
      return result;
    } catch (error) {
      await this.fail(log.id, error);
      return null;
    }
  }

  async findOne(id: string): Promise<CronLogEntity | null> {
    return this.cronLogRepository.findOne({ where: { id } });
  }

  async findOneOrFail(id: string): Promise<CronLogEntity> {
    const log = await this.cronLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(CRON_LOG_ERRORS.NOT_FOUND);
    }
    return log;
  }

  async findAll(query: CronLogQueryDto) {
    const { dataQuery, countQuery, params, countParams } = buildCronLogListQuery(query);
    const { query: statsQuery, params: statsParams } = buildCronLogStatsQuery();

    const [records, countResult, statsResult] = await Promise.all([
      this.cronLogRepository.executeRawQuery(dataQuery, params),
      this.cronLogRepository.executeRawQuery(countQuery, countParams),
      this.cronLogRepository.executeRawQuery(statsQuery, statsParams),
    ]);

    const stats = this.transformStats(statsResult);

    return {
      stats,
      records,
      totalRecords: countResult[0]?.total || 0,
    };
  }

  /**
   * Transform raw stats into structured format
   */
  private transformStats(rawStats: any[]) {
    const statsMap = new Map<string, any>();

    for (const stat of rawStats) {
      const jobName = stat.jobName;
      if (!statsMap.has(jobName)) {
        statsMap.set(jobName, {
          jobName,
          totalRuns: 0,
          successCount: 0,
          failedCount: 0,
          runningCount: 0,
          avgDurationMs: 0,
          lastRun: null,
        });
      }

      const jobStats = statsMap.get(jobName);
      const count = stat.count || 0;
      jobStats.totalRuns += count;

      if (stat.status === CronJobStatus.SUCCESS) {
        jobStats.successCount = count;
        jobStats.avgDurationMs = stat.avgDurationMs || 0;
      } else if (stat.status === CronJobStatus.FAILED) {
        jobStats.failedCount = count;
      } else if (stat.status === CronJobStatus.RUNNING) {
        jobStats.runningCount = count;
      }

      if (!jobStats.lastRun || new Date(stat.lastRun) > new Date(jobStats.lastRun)) {
        jobStats.lastRun = stat.lastRun;
      }
    }

    return {
      jobs: Array.from(statsMap.values()),
      summary: {
        totalJobs: statsMap.size,
        totalRuns: Array.from(statsMap.values()).reduce((sum, j) => sum + j.totalRuns, 0),
        totalSuccess: Array.from(statsMap.values()).reduce((sum, j) => sum + j.successCount, 0),
        totalFailed: Array.from(statsMap.values()).reduce((sum, j) => sum + j.failedCount, 0),
        totalRunning: Array.from(statsMap.values()).reduce((sum, j) => sum + j.runningCount, 0),
      },
    };
  }

  async cleanup(
    retentionDays: number = DEFAULT_CRON_LOG_RETENTION_DAYS,
  ): Promise<{ deletedCount: number; message: string }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedCount = await this.cronLogRepository.deleteOlderThan(cutoffDate);

    this.logger.log(
      `Cron log cleanup: Deleted ${deletedCount} logs older than ${retentionDays} days`,
    );

    return {
      deletedCount,
      message: CRON_LOG_RESPONSES.CLEANUP.replace(
        '{deletedCount}',
        deletedCount.toString(),
      ).replace('{retentionDays}', retentionDays.toString()),
    };
  }

  async getRecentFailures(hours = 24) {
    const { query, params } = buildRecentFailuresQuery(hours);
    return this.cronLogRepository.executeRawQuery(query, params);
  }
}
