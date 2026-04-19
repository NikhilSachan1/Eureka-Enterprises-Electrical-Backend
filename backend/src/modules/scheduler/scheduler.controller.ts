import {
  Controller,
  Get,
  Post,
  Param,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CronJob } from 'cron';
import { CronOrchestratorService } from './crons/cron-orchestrator.service';
import { AttendanceCronService } from './crons/attendance.cron.service';
import { LeaveCronService } from './crons/leave.cron.service';
import { ConfigSettingCronService } from './crons/config-setting.cron.service';
import { SalaryStructureCronService } from './crons/salary-structure.cron.service';
import { PayrollCronService } from './crons/payroll.cron.service';
import { CRON_NAMES, CRON_SCHEDULES } from './constants/scheduler.constants';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * All triggerable crons with their metadata.
 * schedule is in UTC (as stored in CRON_SCHEDULES).
 * nextRun is always computed in IST for readability.
 */
const CRON_METADATA: Record<
  string,
  { description: string; schedule: string; group: string }
> = {
  // ── Orchestrators ──────────────────────────────────────────────────────────
  [CRON_NAMES.DAILY_MIDNIGHT_ORCHESTRATOR]: {
    description:
      'Runs at 12:00 AM IST — Config activation → Salary structure activation → Mark approval pending → Daily attendance entry',
    schedule: CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR,
    group: 'Orchestrator',
  },
  [CRON_NAMES.MONTHLY_AUTO_APPROVE_ORCHESTRATOR]: {
    description:
      'Runs on 1st of every month at 12:00 AM IST — Auto-approve leaves → Auto-approve attendance',
    schedule: CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_ORCHESTRATOR,
    group: 'Orchestrator',
  },
  [CRON_NAMES.APRIL_1_FY_ORCHESTRATOR]: {
    description:
      'Runs on April 1st at 12:00 AM IST — FY leave config auto-copy → Leave carry forward',
    schedule: CRON_SCHEDULES.APRIL_1_ORCHESTRATOR,
    group: 'Orchestrator',
  },

  // ── Attendance ─────────────────────────────────────────────────────────────
  [CRON_NAMES.CONFIG_SETTING_ACTIVATION]: {
    description: 'Activates/deactivates config settings based on effectiveFrom/effectiveTo dates',
    schedule: CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR,
    group: 'Attendance',
  },
  [CRON_NAMES.SALARY_STRUCTURE_ACTIVATION]: {
    description: 'Activates/deactivates salary structures based on effective dates',
    schedule: CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR,
    group: 'Attendance',
  },
  [CRON_NAMES.MARK_APPROVAL_PENDING]: {
    description: "Marks previous day's CHECKED_OUT attendance as APPROVAL_PENDING",
    schedule: CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR,
    group: 'Attendance',
  },
  [CRON_NAMES.DAILY_ATTENDANCE_ENTRY]: {
    description: 'Creates daily attendance records for all active employees',
    schedule: CRON_SCHEDULES.DAILY_MIDNIGHT_ORCHESTRATOR,
    group: 'Attendance',
  },
  [CRON_NAMES.END_OF_DAY_ATTENDANCE]: {
    description: "Auto-checkout and marks absent for employees who didn't check in",
    schedule: CRON_SCHEDULES.DAILY_END_OF_DAY_IST,
    group: 'Attendance',
  },
  [CRON_NAMES.AUTO_APPROVE_ATTENDANCE]: {
    description: "Auto-approves previous month's pending attendance before payroll",
    schedule: CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_ORCHESTRATOR,
    group: 'Attendance',
  },

  // ── Leave ──────────────────────────────────────────────────────────────────
  [CRON_NAMES.FY_LEAVE_CONFIG_AUTO_COPY]: {
    description:
      'Copies leave configs from previous financial year to new FY if not already configured',
    schedule: CRON_SCHEDULES.APRIL_1_ORCHESTRATOR,
    group: 'Leave',
  },
  [CRON_NAMES.LEAVE_CARRY_FORWARD]: {
    description: 'Carries forward eligible leave balances from previous FY to new FY',
    schedule: CRON_SCHEDULES.APRIL_1_ORCHESTRATOR,
    group: 'Leave',
  },
  [CRON_NAMES.AUTO_APPROVE_LEAVES]: {
    description: "Auto-approves previous month's pending leave applications before payroll",
    schedule: CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_ORCHESTRATOR,
    group: 'Leave',
  },
  [CRON_NAMES.MONTHLY_LEAVE_ACCRUAL]: {
    description: 'Credits monthly leave accrual for all active employees',
    schedule: CRON_SCHEDULES.MONTHLY_FIRST_1230AM_IST,
    group: 'Leave',
  },

  // ── Payroll ────────────────────────────────────────────────────────────────
  [CRON_NAMES.MONTHLY_PAYROLL_GENERATION]: {
    description: 'Auto-generates draft payroll for the previous month on the 2nd of every month',
    schedule: CRON_SCHEDULES.MONTHLY_SECOND_1AM_IST,
    group: 'Payroll',
  },
};

@ApiTags('Scheduler')
@ApiBearerAuth('JWT-auth')
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly cronOrchestratorService: CronOrchestratorService,
    private readonly attendanceCronService: AttendanceCronService,
    private readonly leaveCronService: LeaveCronService,
    private readonly configSettingCronService: ConfigSettingCronService,
    private readonly salaryStructureCronService: SalaryStructureCronService,
    private readonly payrollCronService: PayrollCronService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // GET /scheduler/crons
  // ──────────────────────────────────────────────────────────────────────────
  @Get('crons')
  @ApiOperation({
    summary: 'List all crons',
    description:
      'Returns all registered cron jobs with their schedule (UTC cron expression), next scheduled run time in IST, and a human-readable description.',
  })
  listCrons() {
    const result = Object.entries(CRON_METADATA).map(([name, meta]) => ({
      name,
      group: meta.group,
      description: meta.description,
      scheduleExpression: meta.schedule,
      nextRunIST: this.getNextRunIST(meta.schedule),
    }));

    // Sort by group then name for readability
    result.sort((a, b) =>
      a.group !== b.group ? a.group.localeCompare(b.group) : a.name.localeCompare(b.name),
    );

    return { crons: result, total: result.length };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /scheduler/crons/:name/trigger
  // ──────────────────────────────────────────────────────────────────────────
  @Post('crons/:name/trigger')
  @ApiOperation({
    summary: 'Manually trigger a cron',
    description:
      'Manually executes a cron job by name. Returns the job result synchronously. Use the cron name from GET /scheduler/crons.',
  })
  @ApiParam({
    name: 'name',
    description: 'Cron job name (e.g. DailyMidnightOrchestrator, ConfigSettingActivation)',
    example: 'ConfigSettingActivation',
  })
  async triggerCron(
    @Param('name') name: string,
    @Body() body: { targetDate?: string; targetMonth?: number; targetYear?: number } = {},
  ) {
    const handler = this.getHandler(name, body);
    if (!handler) {
      throw new BadRequestException(
        `Unknown cron name: "${name}". Use GET /scheduler/crons to see valid names.`,
      );
    }

    const startTime = Date.now();
    const result = await handler();
    const durationMs = Date.now() - startTime;

    return {
      cronName: name,
      triggeredAt: new Date().toISOString(),
      durationMs,
      result,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private getHandler(
    name: string,
    body: { targetDate?: string; targetMonth?: number; targetYear?: number },
  ): (() => Promise<any>) | null {
    const map: Record<string, () => Promise<any>> = {
      // Orchestrators
      [CRON_NAMES.DAILY_MIDNIGHT_ORCHESTRATOR]: () =>
        this.cronOrchestratorService.handleDailyMidnightOrchestrator(),
      [CRON_NAMES.MONTHLY_AUTO_APPROVE_ORCHESTRATOR]: () =>
        this.cronOrchestratorService.handleMonthlyAutoApproveOrchestrator(),
      [CRON_NAMES.APRIL_1_FY_ORCHESTRATOR]: () =>
        this.cronOrchestratorService.handleApril1FYOrchestrator(),

      // Attendance
      [CRON_NAMES.CONFIG_SETTING_ACTIVATION]: () =>
        this.configSettingCronService.handleConfigSettingActivationDirect(),
      [CRON_NAMES.SALARY_STRUCTURE_ACTIVATION]: () =>
        this.salaryStructureCronService.handleSalaryStructureActivationDirect(),
      [CRON_NAMES.MARK_APPROVAL_PENDING]: () =>
        this.attendanceCronService.handleMarkApprovalPendingDirect(),
      [CRON_NAMES.DAILY_ATTENDANCE_ENTRY]: () =>
        this.attendanceCronService.handleDailyAttendanceEntryDirect(body.targetDate),
      [CRON_NAMES.END_OF_DAY_ATTENDANCE]: () =>
        this.attendanceCronService.handleEndOfDayAttendanceDirect(body.targetDate),
      [CRON_NAMES.AUTO_APPROVE_ATTENDANCE]: () =>
        this.attendanceCronService.handleAutoApproveAttendanceDirect(),

      // Leave
      [CRON_NAMES.FY_LEAVE_CONFIG_AUTO_COPY]: () =>
        this.leaveCronService.handleFYLeaveConfigAutoCopyDirect(body.targetYear),
      [CRON_NAMES.LEAVE_CARRY_FORWARD]: () =>
        this.leaveCronService.handleLeaveCarryForwardDirect(body.targetYear),
      [CRON_NAMES.AUTO_APPROVE_LEAVES]: () =>
        this.leaveCronService.handleAutoApproveLeavesDirect(),
      [CRON_NAMES.MONTHLY_LEAVE_ACCRUAL]: () =>
        this.leaveCronService.handleMonthlyLeaveAccrual(),

      // Payroll
      [CRON_NAMES.MONTHLY_PAYROLL_GENERATION]: () =>
        this.payrollCronService.handleMonthlyPayrollGenerationManual(
          body.targetMonth,
          body.targetYear,
        ),
    };

    return map[name] || null;
  }

  private getNextRunIST(cronExpression: string): string {
    try {
      const job = new CronJob(cronExpression, () => {}, null, false, IST_TIMEZONE);
      const next = job.nextDate();
      // Format: "20 Apr 2026, 12:00:30 AM IST"
      return next.toFormat("dd MMM yyyy, hh:mm:ss a 'IST'");
    } catch {
      return 'Unable to compute';
    }
  }
}
