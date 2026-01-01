import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchedulerService } from '../scheduler.service';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  CRON_SCHEDULES,
  CRON_NAMES,
  CRON_GROUPS,
  CRON_TIMEOUT_MS,
} from '../constants/scheduler.constants';
import { ConfigSettingCronService } from './config-setting.cron.service';
import { SalaryStructureCronService } from './salary-structure.cron.service';
import { AttendanceCronService } from './attendance.cron.service';
import { LeaveCronService } from './leave.cron.service';
import { CronJobResult, OrchestratorResult } from '../types/cron-orchestrator.types';

@Injectable()
export class CronOrchestratorService {
  private readonly logger = new Logger(CronOrchestratorService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly cronLogService: CronLogService,
    private readonly configSettingCronService: ConfigSettingCronService,
    private readonly salaryStructureCronService: SalaryStructureCronService,
    private readonly attendanceCronService: AttendanceCronService,
    private readonly leaveCronService: LeaveCronService,
  ) {}

  private getJobHandler(jobName: string): (() => Promise<any>) | null {
    const handlers: Record<string, () => Promise<any>> = {
      // Daily Midnight Group
      [CRON_NAMES.CONFIG_SETTING_ACTIVATION]: () =>
        this.configSettingCronService.handleConfigSettingActivationDirect(),
      [CRON_NAMES.SALARY_STRUCTURE_ACTIVATION]: () =>
        this.salaryStructureCronService.handleSalaryStructureActivationDirect(),
      [CRON_NAMES.DAILY_ATTENDANCE_ENTRY]: () =>
        this.attendanceCronService.handleDailyAttendanceEntryDirect(),

      // Monthly Auto-Approve Group
      [CRON_NAMES.AUTO_APPROVE_LEAVES]: () => this.leaveCronService.handleAutoApproveLeavesDirect(),
      [CRON_NAMES.AUTO_APPROVE_ATTENDANCE]: () =>
        this.attendanceCronService.handleAutoApproveAttendanceDirect(),

      // April 1st FY Group
      [CRON_NAMES.FY_LEAVE_CONFIG_AUTO_COPY]: () =>
        this.leaveCronService.handleFYLeaveConfigAutoCopyDirect(),
      [CRON_NAMES.LEAVE_CARRY_FORWARD]: () => this.leaveCronService.handleLeaveCarryForwardDirect(),
    };

    return handlers[jobName] || null;
  }

  private async executeJobWithTimeout(
    jobName: string,
    handler: () => Promise<any>,
  ): Promise<CronJobResult> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${jobName} timed out after ${CRON_TIMEOUT_MS}ms`));
        }, CRON_TIMEOUT_MS);
      });

      const result = await Promise.race([handler(), timeoutPromise]);

      const durationMs = Date.now() - startTime;

      if (result === null) {
        return {
          jobName,
          status: 'skipped',
          durationMs,
          result: 'Skipped (conditional check not met)',
        };
      }

      return {
        jobName,
        status: 'success',
        durationMs,
        result,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const isTimeout = error.message?.includes('timed out');

      return {
        jobName,
        status: isTimeout ? 'timeout' : 'failed',
        durationMs,
        error: error.message,
      };
    }
  }

  private async executeGroup(
    groupName: string,
    jobNames: string[],
    cronJobType: CronJobType,
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const result: OrchestratorResult = {
      groupName,
      totalJobs: jobNames.length,
      successful: 0,
      skipped: 0,
      failed: 0,
      timedOut: 0,
      jobs: [],
      totalDurationMs: 0,
    };

    this.logger.log(
      `[${groupName}] Starting orchestrated execution of ${jobNames.length} jobs for ${cronJobType}`,
    );

    for (const jobName of jobNames) {
      const handler = this.getJobHandler(jobName);

      if (!handler) {
        this.logger.error(`[${groupName}] No handler found for job: ${jobName}`);
        result.jobs.push({
          jobName,
          status: 'failed',
          durationMs: 0,
          error: 'No handler found',
        });
        result.failed++;
        continue;
      }

      this.logger.log(`[${groupName}] Executing: ${jobName}`);

      const jobResult = await this.executeJobWithTimeout(jobName, handler);
      result.jobs.push(jobResult);

      switch (jobResult.status) {
        case 'success':
          result.successful++;
          this.logger.log(`[${groupName}] ✅ ${jobName} completed in ${jobResult.durationMs}ms`);
          break;
        case 'skipped':
          result.skipped++;
          this.logger.log(`[${groupName}] ⏭️ ${jobName} skipped`);
          break;
        case 'timeout':
          result.timedOut++;
          this.logger.error(
            `[${groupName}] ⏰ ${jobName} timed out after ${jobResult.durationMs}ms`,
          );
          break;
        case 'failed':
          result.failed++;
          this.logger.error(`[${groupName}] ❌ ${jobName} failed: ${jobResult.error}`);
          break;
      }
    }

    result.totalDurationMs = Date.now() - startTime;

    this.logger.log(
      `[${groupName}] Completed: ${result.successful} success, ${result.skipped} skipped, ` +
        `${result.failed} failed, ${result.timedOut} timeout (${result.totalDurationMs}ms total)`,
    );

    return result;
  }

  // ============================================
  // ORCHESTRATED CRON HANDLERS
  // ============================================

  /**
   * Daily Midnight Orchestrator
   * Runs at 12:00 AM IST
   *
   * Sequence:
   * 1. Config Setting Activation - Activates/deactivates configs based on effectiveFrom/To
   * 2. Salary Structure Activation - Activates/deactivates salary structures
   * 3. Daily Attendance Entry - Creates attendance records for all users
   *
   * Reason for sequence:
   * - Config must be active before attendance uses it
   * - Salary structure depends on configs
   * - Attendance entry uses active configs
   */
  @Cron(CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR)
  async handleDailyMidnightOrchestrator(): Promise<OrchestratorResult | null> {
    const cronName = CRON_NAMES.DAILY_MIDNIGHT_ORCHESTRATOR;

    return this.cronLogService.execute(cronName, CronJobType.CONFIG, async () => {
      return this.executeGroup('DailyMidnight', CRON_GROUPS.DAILY_MIDNIGHT, CronJobType.CONFIG);
    });
  }

  /**
   * Monthly Auto-Approve Orchestrator
   * Runs on 1st of every month at 12:00 AM IST
   *
   * Sequence:
   * 1. Auto Approve Leaves - Approves pending leaves from previous month
   * 2. Auto Approve Attendance - Approves pending attendance from previous month
   *
   * Reason for sequence:
   * - Both must complete before Monthly Leave Accrual (12:30 AM)
   * - Leaves approved first as attendance might reference leave data
   */
  @Cron(CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_ORCHESTRATOR)
  async handleMonthlyAutoApproveOrchestrator(): Promise<OrchestratorResult | null> {
    const cronName = CRON_NAMES.MONTHLY_AUTO_APPROVE_ORCHESTRATOR;

    // Skip if not 1st of month (safety check - cron should handle this)
    const today = this.schedulerService.getCurrentDateIST();
    if (today.getDate() !== 1) {
      this.logger.log(`[${cronName}] Skipping - not 1st of month`);
      return null;
    }

    return this.cronLogService.execute(cronName, CronJobType.LEAVE, async () => {
      return this.executeGroup(
        'MonthlyAutoApprove',
        CRON_GROUPS.MONTHLY_AUTO_APPROVE,
        CronJobType.LEAVE,
      );
    });
  }

  /**
   * April 1st Financial Year Orchestrator
   * Runs on April 1st at 12:00 AM IST
   *
   * Sequence:
   * 1. FY Leave Config Auto Copy - Copies leave configs from previous FY if not updated
   * 2. Leave Carry Forward - Carries forward eligible leaves to new FY
   *
   * Reason for sequence:
   * - Config must exist for new FY before carry forward can process
   * - Carry forward needs leave category configs to determine eligibility
   */
  @Cron(CRON_SCHEDULES.APRIL_1_ORCHESTRATOR)
  async handleApril1FYOrchestrator(): Promise<OrchestratorResult | null> {
    const cronName = CRON_NAMES.APRIL_1_FY_ORCHESTRATOR;

    // Only run on April 1st
    const today = this.schedulerService.getCurrentDateIST();
    if (today.getMonth() !== 3 || today.getDate() !== 1) {
      // Month is 0-indexed, 3 = April
      this.logger.log(`[${cronName}] Skipping - not April 1st`);
      return null;
    }

    return this.cronLogService.execute(cronName, CronJobType.CONFIG, async () => {
      return this.executeGroup('April1FY', CRON_GROUPS.APRIL_1_FY, CronJobType.CONFIG);
    });
  }
}
