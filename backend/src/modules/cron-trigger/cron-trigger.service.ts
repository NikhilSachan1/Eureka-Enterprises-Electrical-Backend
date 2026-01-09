import { Injectable, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import { TriggerCronDto, TriggerCronResponseDto } from './dto';
import {
  TriggerableCronJob,
  CRON_DEPENDENCIES,
  CRON_JOB_DESCRIPTIONS,
  JOBS_REQUIRING_DATE,
  JOBS_REQUIRING_MONTH_YEAR,
  JOBS_REQUIRING_YEAR,
  CRON_TRIGGER_ERRORS,
  CRON_TRIGGER_SUCCESS,
} from './constants/cron-trigger.constants';
import { CronLogService } from '../cron-logs/cron-log.service';
import { CronJobStatus, CronTriggerType } from '../cron-logs/constants/cron-log.constants';

// Import cron services
import { ConfigSettingCronService } from '../scheduler/crons/config-setting.cron.service';
import { SalaryStructureCronService } from '../scheduler/crons/salary-structure.cron.service';
import { AttendanceCronService } from '../scheduler/crons/attendance.cron.service';
import { LeaveCronService } from '../scheduler/crons/leave.cron.service';
import { CardCronService } from '../scheduler/crons/card.cron.service';
import { AssetCronService } from '../scheduler/crons/asset.cron.service';
import { VehicleCronService } from '../scheduler/crons/vehicle.cron.service';
import { ExpenseCronService } from '../scheduler/crons/expense.cron.service';
import { PayrollCronService } from '../scheduler/crons/payroll.cron.service';
import { CelebrationCronService } from '../scheduler/crons/celebration.cron.service';
import { AnnouncementCronService } from '../scheduler/crons/announcement.cron.service';
import { CronOrchestratorService } from '../scheduler/crons/cron-orchestrator.service';
import { SchedulerService } from '../scheduler/scheduler.service';

@Injectable()
export class CronTriggerService {
  private readonly logger = new Logger(CronTriggerService.name);
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly cronLogService: CronLogService,
    private readonly schedulerService: SchedulerService,
    private readonly configSettingCronService: ConfigSettingCronService,
    private readonly salaryStructureCronService: SalaryStructureCronService,
    private readonly attendanceCronService: AttendanceCronService,
    private readonly leaveCronService: LeaveCronService,
    private readonly cardCronService: CardCronService,
    private readonly assetCronService: AssetCronService,
    private readonly vehicleCronService: VehicleCronService,
    private readonly expenseCronService: ExpenseCronService,
    private readonly payrollCronService: PayrollCronService,
    private readonly celebrationCronService: CelebrationCronService,
    private readonly announcementCronService: AnnouncementCronService,
    private readonly cronOrchestratorService: CronOrchestratorService,
  ) {}

  listAvailableJobs() {
    const jobs = Object.values(TriggerableCronJob).map((jobName) => {
      const requiredParameters: string[] = [];

      if (JOBS_REQUIRING_DATE.includes(jobName)) {
        requiredParameters.push('date');
      }
      if (JOBS_REQUIRING_MONTH_YEAR.includes(jobName)) {
        requiredParameters.push('month', 'year');
      }
      if (JOBS_REQUIRING_YEAR.includes(jobName)) {
        requiredParameters.push('year');
      }

      return {
        name: jobName,
        description: CRON_JOB_DESCRIPTIONS[jobName],
        requiredParameters,
        dependencies: CRON_DEPENDENCIES[jobName],
      };
    });

    return { jobs };
  }

  async triggerJob(dto: TriggerCronDto, triggeredBy: string): Promise<TriggerCronResponseDto> {
    const { jobName, dryRun, skipDependencyCheck, forceRun } = dto;
    const startTime = Date.now();

    // Generate a unique key for this job execution
    const jobKey = this.getJobKey(dto);

    try {
      // 1. Validate parameters
      this.validateParameters(dto);

      // 2. Check if job is already running
      if (this.runningJobs.has(jobKey)) {
        throw new ConflictException(CRON_TRIGGER_ERRORS.JOB_IN_PROGRESS);
      }

      // 3. Check dependencies (unless skipped)
      if (!skipDependencyCheck) {
        await this.validateDependencies(dto);
      }

      // 4. Check if already processed (unless forced)
      if (!forceRun && !dryRun) {
        await this.checkIdempotency(dto);
      }

      // 5. Mark job as running
      this.runningJobs.add(jobKey);

      // 6. Log the manual trigger
      const cronLog = await this.cronLogService.start(
        `MANUAL_${jobName}`,
        this.getJobType(jobName) as any, // Job type string
        CronTriggerType.MANUAL,
        triggeredBy,
      );

      try {
        // 7. Execute the job
        let result: any;

        if (dryRun) {
          result = await this.executeDryRun(dto);
        } else {
          result = await this.executeJob(dto, triggeredBy);
        }

        // 8. Log success
        await this.cronLogService.success(cronLog.id, result);

        const duration = Date.now() - startTime;

        return {
          success: true,
          message: dryRun
            ? CRON_TRIGGER_SUCCESS.DRY_RUN_COMPLETE
            : CRON_TRIGGER_SUCCESS.JOB_COMPLETED,
          jobName,
          details: {
            recordsProcessed: result?.processed || result?.count || 0,
            recordsSkipped: result?.skipped || 0,
            recordsFailed: result?.failed || 0,
            errors: result?.errors || [],
            duration,
          },
          parameters: this.getExecutionParameters(dto),
          dryRun,
        };
      } catch (error) {
        // Log failure
        await this.cronLogService.fail(cronLog.id, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to trigger job ${jobName}:`, error);

      return {
        success: false,
        message: error.message || 'Job execution failed',
        jobName,
        details: {
          errors: [error.message],
          duration: Date.now() - startTime,
        },
        parameters: this.getExecutionParameters(dto),
        dryRun,
      };
    } finally {
      // Remove from running jobs
      this.runningJobs.delete(jobKey);
    }
  }

  private validateParameters(dto: TriggerCronDto): void {
    const { jobName, date, month, year } = dto;

    // Validate date for date-based jobs
    if (JOBS_REQUIRING_DATE.includes(jobName)) {
      if (!date) {
        throw new BadRequestException(CRON_TRIGGER_ERRORS.DATE_REQUIRED);
      }
      // Check not future date - use IST timezone for comparison
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const todayIST = this.schedulerService.getTodayDateIST();
      if (targetDate > todayIST) {
        throw new BadRequestException(CRON_TRIGGER_ERRORS.FUTURE_DATE_NOT_ALLOWED);
      }
    }

    // Validate month/year for monthly jobs
    if (JOBS_REQUIRING_MONTH_YEAR.includes(jobName)) {
      if (!month || !year) {
        throw new BadRequestException(CRON_TRIGGER_ERRORS.MONTH_YEAR_REQUIRED);
      }
      // Check not future month - use IST timezone for comparison
      const nowIST = this.schedulerService.getCurrentDateIST();
      const currentYear = nowIST.getFullYear();
      const currentMonth = nowIST.getMonth() + 1; // 1-indexed
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        throw new BadRequestException(CRON_TRIGGER_ERRORS.FUTURE_MONTH_NOT_ALLOWED);
      }
    }

    // Validate year for yearly jobs
    if (JOBS_REQUIRING_YEAR.includes(jobName)) {
      if (!year) {
        throw new BadRequestException(CRON_TRIGGER_ERRORS.YEAR_REQUIRED);
      }
    }
  }

  private async validateDependencies(dto: TriggerCronDto): Promise<void> {
    const { jobName, date, month, year } = dto;
    const dependencies = CRON_DEPENDENCIES[jobName];

    if (!dependencies || dependencies.length === 0) {
      return;
    }

    for (const dependency of dependencies) {
      const dependencyExecuted = await this.checkDependencyExecuted(dependency, date, month, year);

      if (!dependencyExecuted) {
        throw new BadRequestException(
          CRON_TRIGGER_ERRORS.DEPENDENCY_NOT_MET.replace('{dependency}', dependency).replace(
            '{job}',
            jobName,
          ),
        );
      }
    }
  }

  private async checkDependencyExecuted(
    jobName: TriggerableCronJob,
    date?: string,
    month?: number,
    year?: number,
  ): Promise<boolean> {
    let startDate: Date;
    let endDate: Date;

    if (date) {
      // Parse date string and set to start/end of day
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    } else if (month && year) {
      // First and last day of the specified month
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (year) {
      // For yearly jobs, check if run on April 1st (FY start)
      startDate = new Date(year, 3, 1, 0, 0, 0, 0); // April 1st
      endDate = new Date(year, 3, 1, 23, 59, 59, 999);
    } else {
      // For jobs without date params, check today in IST
      const todayIST = this.schedulerService.getTodayDateIST();
      startDate = new Date(todayIST);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(todayIST);
      endDate.setHours(23, 59, 59, 999);
    }

    // Check cron logs for successful execution
    const { records } = await this.cronLogService.findAll({
      jobName: `MANUAL_${jobName}`,
      status: CronJobStatus.SUCCESS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      pageSize: 1,
      page: 1,
    });

    // Also check for scheduled executions
    if (records.length === 0) {
      const { records: scheduledRecords } = await this.cronLogService.findAll({
        jobName: jobName,
        status: CronJobStatus.SUCCESS,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        pageSize: 1,
        page: 1,
      });
      return scheduledRecords.length > 0;
    }

    return records.length > 0;
  }

  private async checkIdempotency(dto: TriggerCronDto): Promise<void> {
    const { jobName, date, month, year } = dto;

    // Build date range based on job type
    let startDate: Date;
    let endDate: Date;

    if (JOBS_REQUIRING_DATE.includes(jobName) && date) {
      startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
    } else if (JOBS_REQUIRING_MONTH_YEAR.includes(jobName) && month && year) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      // For jobs without specific periods, always allow (they're idempotent by nature)
      return;
    }

    // Check if already processed
    const { records } = await this.cronLogService.findAll({
      jobName: `MANUAL_${jobName}`,
      status: CronJobStatus.SUCCESS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      pageSize: 1,
      page: 1,
    });

    if (records.length > 0) {
      throw new ConflictException(CRON_TRIGGER_ERRORS.ALREADY_PROCESSED);
    }
  }

  private async executeDryRun(dto: TriggerCronDto): Promise<any> {
    const { jobName, date, month, year, userId } = dto;

    // Use IST timezone for timestamp
    const currentIST = this.schedulerService.getCurrentDateIST();
    const baseResponse = {
      preview: true,
      dryRun: true,
      jobName,
      timestamp: currentIST.toISOString(),
      timezone: this.schedulerService.getOrgTimezone(),
    };

    switch (jobName) {
      // ============ Daily Midnight - Sequential Jobs ============

      case TriggerableCronJob.CONFIG_ACTIVATION:
        return {
          ...baseResponse,
          message: 'Would activate/deactivate config settings based on effective dates',
          description:
            'Checks all config settings and updates isActive status based on effectiveFrom/effectiveTo dates',
          potentialActions: [
            'Activate configs where effectiveFrom <= today',
            'Deactivate configs where effectiveTo < today',
          ],
        };

      case TriggerableCronJob.SALARY_STRUCTURE_ACTIVATION:
        return {
          ...baseResponse,
          message: 'Would activate/deactivate salary structures based on effective dates',
          description: 'Updates salary structure status based on effectiveFrom/effectiveTo dates',
          potentialActions: [
            'Activate salary structures where effectiveFrom <= today',
            'Deactivate salary structures where effectiveTo < today',
          ],
        };

      case TriggerableCronJob.DAILY_ATTENDANCE_ENTRY:
        return {
          ...baseResponse,
          message: `Would create attendance entries for ${date || 'today'}`,
          targetDate: date || 'today',
          affectedUsers: userId ? `Single user: ${userId}` : 'All active employees',
          potentialStatuses: ['NOT_CHECKED_IN_YET', 'HOLIDAY', 'LEAVE', 'LEAVE_WITHOUT_PAY'],
          description:
            'Creates initial attendance records for all active employees based on their leave/holiday status',
        };

      case TriggerableCronJob.END_OF_DAY_ATTENDANCE:
        return {
          ...baseResponse,
          message: `Would finalize attendance at end of shift for ${date || 'today'}`,
          targetDate: date || 'today',
          description:
            'Finalizes attendance at shift end - auto-checkout, mark absent, create missing records',
          potentialActions: [
            'Auto-checkout users who are still CHECKED_IN at shift end time',
            'Mark NOT_CHECKED_IN_YET users as ABSENT',
            'Create ABSENT records for users added after morning cron',
          ],
        };

      case TriggerableCronJob.AUTO_APPROVE_ATTENDANCE:
        return {
          ...baseResponse,
          message: 'Would auto-approve pending attendance records past the approval window',
          description:
            'Approves attendance records that have been pending beyond the configured auto-approval days',
          potentialActions: [
            'Find pending attendance records older than auto-approval window',
            'Update approvalStatus to APPROVED',
            'Set isActive to true',
          ],
        };

      case TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY:
        return {
          ...baseResponse,
          message: `Would copy leave configuration to FY ${year || 'current'}-${
            (year || new Date().getFullYear()) + 1
          }`,
          targetFY: year ? `${year}-${year + 1}` : 'Current FY',
          description: 'Copies all leave category configurations from previous FY to new FY',
          potentialActions: [
            'Fetch leave configs from previous FY',
            'Create new config settings for new FY',
            'Update effectiveFrom/effectiveTo dates',
          ],
        };

      case TriggerableCronJob.LEAVE_CARRY_FORWARD:
        return {
          ...baseResponse,
          message: `Would carry forward eligible leave balances to FY ${year || 'current'}-${
            (year || new Date().getFullYear()) + 1
          }`,
          targetFY: year ? `${year}-${year + 1}` : 'Current FY',
          description:
            'Transfers unused leave balances to the new financial year based on carryForward settings',
          potentialActions: [
            'Check leave categories with carryForward enabled',
            'Calculate unused balances per user',
            'Apply maxCarryForward limits',
            'Credit balances to new FY',
          ],
        };

      case TriggerableCronJob.AUTO_APPROVE_LEAVES:
        return {
          ...baseResponse,
          message: 'Would auto-approve pending leave applications past the approval window',
          description:
            'Approves leave applications that have been pending beyond the configured auto-approval days',
          potentialActions: [
            'Find pending leave applications older than auto-approval window',
            'Update status to APPROVED',
            'Adjust leave balances',
          ],
        };

      // ============ Daily 9 AM - Independent Alert Jobs ============

      case TriggerableCronJob.CARD_EXPIRY_ALERT:
        return {
          ...baseResponse,
          message: 'Would send alerts for cards expiring soon or already expired',
          description: 'Checks card expiry dates and sends email notifications',
          alertTypes: ['Cards expiring in 30 days', 'Cards expiring in 7 days', 'Expired cards'],
          recipients: 'Card holders and managers',
        };

      case TriggerableCronJob.ASSET_CALIBRATION_EXPIRY_ALERT:
        return {
          ...baseResponse,
          message: 'Would send alerts for assets with calibration expiring soon',
          description: 'Checks asset calibration due dates and sends reminders',
          alertTypes: [
            'Calibration due in 30 days',
            'Calibration due in 7 days',
            'Overdue calibration',
          ],
          recipients: 'Asset managers and assigned users',
        };

      case TriggerableCronJob.ASSET_WARRANTY_EXPIRY_ALERT:
        return {
          ...baseResponse,
          message: 'Would send alerts for assets with warranty expiring soon',
          description: 'Checks asset warranty expiry dates and sends notifications',
          alertTypes: [
            'Warranty expiring in 30 days',
            'Warranty expiring in 7 days',
            'Expired warranty',
          ],
          recipients: 'Asset managers and assigned users',
        };

      case TriggerableCronJob.VEHICLE_DOCUMENT_EXPIRY_ALERT:
        return {
          ...baseResponse,
          message: 'Would send alerts for vehicle documents expiring soon',
          description: 'Checks vehicle document expiry (insurance, RC, pollution, etc.)',
          documentTypes: [
            'Insurance',
            'Registration Certificate',
            'Pollution Certificate',
            'Fitness Certificate',
          ],
          alertTypes: ['Expiring in 30 days', 'Expiring in 7 days', 'Expired'],
          recipients: 'Fleet managers and assigned drivers',
        };

      case TriggerableCronJob.VEHICLE_SERVICE_DUE_REMINDER:
        return {
          ...baseResponse,
          message: 'Would send reminders for vehicles due for service',
          description:
            'Checks vehicle service schedules based on last service date or odometer reading',
          checkCriteria: ['Days since last service', 'KM since last service'],
          recipients: 'Fleet managers and assigned drivers',
        };

      case TriggerableCronJob.PENDING_EXPENSE_REMINDER:
        return {
          ...baseResponse,
          message: 'Would send reminders for pending expense approvals',
          description: 'Sends email reminders to approvers with pending expense requests',
          recipients: 'Expense approvers (managers/HR)',
        };

      case TriggerableCronJob.FY_LEAVE_CONFIG_REMINDER:
        return {
          ...baseResponse,
          message: 'Would send reminder to configure leaves for upcoming FY',
          description: 'Reminds admins to set up leave configuration for the new financial year',
          triggerCondition: 'March (before FY ends)',
          recipients: 'HR admins',
        };

      case TriggerableCronJob.LEAVE_APPROVAL_REMINDER:
        return {
          ...baseResponse,
          message: 'Would send reminders for pending leave approvals',
          description: 'Sends email reminders to approvers with pending leave requests',
          recipients: 'Leave approvers (managers/HR)',
        };

      case TriggerableCronJob.ATTENDANCE_APPROVAL_REMINDER:
        return {
          ...baseResponse,
          message: 'Would send reminders for pending attendance approvals',
          description:
            'Sends email reminders to approvers with pending attendance regularization requests',
          recipients: 'Attendance approvers (managers/HR)',
        };

      // ============ Monthly Jobs ============

      case TriggerableCronJob.MONTHLY_PAYROLL_GENERATION:
        return {
          ...baseResponse,
          message: `Would generate DRAFT payroll for ${month}/${year}`,
          targetMonth: month,
          targetYear: year,
          affectedUsers: userId ? `Single user: ${userId}` : 'All eligible employees',
          payrollStatus: 'DRAFT',
          description:
            'Generates payroll records with all earnings, deductions, attendance calculations',
          calculations: [
            'Basic salary and allowances',
            'Attendance-based deductions',
            'Leave without pay deductions',
            'Holiday bonus calculations',
            'PF, TDS, ESIC deductions',
          ],
        };

      case TriggerableCronJob.MONTHLY_LEAVE_ACCRUAL:
        return {
          ...baseResponse,
          message: `Would credit monthly leave accruals for ${month || 'current month'}/${
            year || 'current year'
          }`,
          targetMonth: month,
          targetYear: year,
          description: 'Credits monthly quota of leaves to employees with monthly creditFrequency',
          potentialActions: [
            'Identify leave categories with monthly frequency',
            'Calculate pro-rata credits based on FY month',
            'Update leave balances',
          ],
        };

      case TriggerableCronJob.CELEBRATION_WISHES:
        return {
          ...baseResponse,
          message: `Would send birthday and anniversary wishes for ${date || 'today'}`,
          targetDate: date || 'today',
          celebrationTypes: [
            'Birthday wishes',
            'Work anniversary wishes',
            'Milestone anniversaries',
          ],
          milestoneYears: [1, 5, 10, 15, 20, 25, 30, 35, 40],
          description: 'Sends personalized birthday and work anniversary emails to employees',
        };

      // ============ Announcement Jobs ============

      case TriggerableCronJob.PUBLISH_SCHEDULED_ANNOUNCEMENTS:
        return {
          ...baseResponse,
          message: 'Would publish announcements scheduled for today',
          description:
            'Finds announcements with publishDate = today and status = SCHEDULED, updates to PUBLISHED',
          potentialActions: [
            'Update status from SCHEDULED to PUBLISHED',
            'Send notifications if enabled',
          ],
        };

      case TriggerableCronJob.EXPIRE_ANNOUNCEMENTS:
        return {
          ...baseResponse,
          message: 'Would expire announcements past their end date',
          description:
            'Finds published announcements with expiryDate < today and updates status to EXPIRED',
          potentialActions: ['Update status from PUBLISHED to EXPIRED'],
        };

      // ============ Orchestrators ============

      case TriggerableCronJob.DAILY_MIDNIGHT_ORCHESTRATOR:
        return {
          ...baseResponse,
          message: 'Would run daily midnight job sequence',
          description: 'Orchestrator that runs a sequence of dependent jobs at midnight in order',
          jobSequence: [
            '1. Config Setting Activation',
            '2. Salary Structure Activation',
            '3. Daily Attendance Entry',
            '4. Auto-Approve Attendance',
          ],
          note: 'Each job waits for the previous one to complete. Failed jobs do not block subsequent jobs.',
        };

      case TriggerableCronJob.MONTHLY_AUTO_APPROVE_ORCHESTRATOR:
        return {
          ...baseResponse,
          message: 'Would run monthly auto-approve sequence on 1st of month',
          description:
            'Orchestrator that runs auto-approval jobs in sequence on the first of each month',
          jobSequence: ['1. Auto-Approve Attendance', '2. Auto-Approve Leaves'],
          note: 'Runs at midnight on 1st of month. Ensures leaves are approved before payroll generation.',
        };

      case TriggerableCronJob.APRIL_1_FY_ORCHESTRATOR:
        return {
          ...baseResponse,
          message: 'Would run financial year transition sequence on April 1st',
          description:
            'Orchestrator that handles new FY setup by copying configs and carrying forward leaves',
          jobSequence: ['1. FY Leave Config Auto-Copy', '2. Leave Carry Forward'],
          note: 'Runs only on April 1st. Config copy must complete before carry forward.',
        };

      default:
        return {
          ...baseResponse,
          message: `Would execute ${jobName}`,
          parameters: { date, month, year, userId },
          warning: 'No specific dry run implementation for this job',
        };
    }
  }

  private async executeJob(dto: TriggerCronDto, triggeredBy: string): Promise<any> {
    const { jobName, date, month, year, userId } = dto;

    this.logger.log(`Executing manual trigger: ${jobName} by ${triggeredBy}`);

    switch (jobName) {
      // Config & Salary Structure
      case TriggerableCronJob.CONFIG_ACTIVATION:
        return await this.configSettingCronService.handleConfigSettingActivationDirect();

      case TriggerableCronJob.SALARY_STRUCTURE_ACTIVATION:
        return await this.salaryStructureCronService.handleSalaryStructureActivationDirect();

      // Attendance
      case TriggerableCronJob.DAILY_ATTENDANCE_ENTRY:
        return await this.attendanceCronService.handleDailyAttendanceEntryDirect(date);

      case TriggerableCronJob.AUTO_APPROVE_ATTENDANCE:
        return await this.attendanceCronService.handleAutoApproveAttendanceDirect();

      case TriggerableCronJob.ATTENDANCE_APPROVAL_REMINDER:
        return await this.attendanceCronService.handleAttendanceApprovalReminder();

      case TriggerableCronJob.END_OF_DAY_ATTENDANCE:
        return await this.attendanceCronService.handleEndOfDayAttendanceDirect(date);

      // Leave
      case TriggerableCronJob.FY_LEAVE_CONFIG_AUTO_COPY:
        return await this.leaveCronService.handleFYLeaveConfigAutoCopyDirect(year);

      case TriggerableCronJob.LEAVE_CARRY_FORWARD:
        return await this.leaveCronService.handleLeaveCarryForwardDirect(year);

      case TriggerableCronJob.AUTO_APPROVE_LEAVES:
        return await this.leaveCronService.handleAutoApproveLeavesDirect();

      case TriggerableCronJob.FY_LEAVE_CONFIG_REMINDER:
        return await this.leaveCronService.handleFYLeaveConfigReminder();

      case TriggerableCronJob.LEAVE_APPROVAL_REMINDER:
        return await this.leaveCronService.handleLeaveApprovalReminder();

      case TriggerableCronJob.MONTHLY_LEAVE_ACCRUAL:
        return await this.leaveCronService.handleMonthlyLeaveAccrualManual(month, year);

      // Alerts
      case TriggerableCronJob.CARD_EXPIRY_ALERT:
        return await this.cardCronService.handleCardExpiryAlerts();

      case TriggerableCronJob.ASSET_CALIBRATION_EXPIRY_ALERT:
        return await this.assetCronService.handleAssetCalibrationExpiryAlerts();

      case TriggerableCronJob.ASSET_WARRANTY_EXPIRY_ALERT:
        return await this.assetCronService.handleAssetWarrantyExpiryAlerts();

      case TriggerableCronJob.VEHICLE_DOCUMENT_EXPIRY_ALERT:
        return await this.vehicleCronService.handleVehicleDocumentExpiryAlerts();

      case TriggerableCronJob.VEHICLE_SERVICE_DUE_REMINDER:
        return await this.vehicleCronService.handleVehicleServiceDueReminders();

      case TriggerableCronJob.PENDING_EXPENSE_REMINDER:
        return await this.expenseCronService.handlePendingExpenseReminders();

      // Payroll
      case TriggerableCronJob.MONTHLY_PAYROLL_GENERATION:
        return await this.payrollCronService.handleMonthlyPayrollGenerationManual(
          month,
          year,
          userId,
        );

      // Celebrations
      case TriggerableCronJob.CELEBRATION_WISHES:
        return await this.celebrationCronService.handleBirthdayAnniversaryWishesManual(date);

      // Announcements
      case TriggerableCronJob.PUBLISH_SCHEDULED_ANNOUNCEMENTS:
        return await this.announcementCronService.handlePublishScheduledAnnouncements();

      case TriggerableCronJob.EXPIRE_ANNOUNCEMENTS:
        return await this.announcementCronService.handleExpireAnnouncements();

      // Orchestrators
      case TriggerableCronJob.DAILY_MIDNIGHT_ORCHESTRATOR:
        return await this.cronOrchestratorService.handleDailyMidnightOrchestrator();

      case TriggerableCronJob.MONTHLY_AUTO_APPROVE_ORCHESTRATOR:
        return await this.cronOrchestratorService.handleMonthlyAutoApproveOrchestrator();

      case TriggerableCronJob.APRIL_1_FY_ORCHESTRATOR:
        return await this.cronOrchestratorService.handleApril1FYOrchestrator();

      default:
        throw new BadRequestException(CRON_TRIGGER_ERRORS.INVALID_JOB_NAME);
    }
  }

  private getJobType(jobName: TriggerableCronJob): string {
    const jobTypeMap: Record<string, string> = {
      CONFIG_ACTIVATION: 'CONFIG',
      SALARY_STRUCTURE_ACTIVATION: 'SALARY_STRUCTURE',
      DAILY_ATTENDANCE_ENTRY: 'ATTENDANCE',
      END_OF_DAY_ATTENDANCE: 'ATTENDANCE',
      AUTO_APPROVE_ATTENDANCE: 'ATTENDANCE',
      ATTENDANCE_APPROVAL_REMINDER: 'NOTIFICATION',
      FY_LEAVE_CONFIG_AUTO_COPY: 'LEAVE',
      LEAVE_CARRY_FORWARD: 'LEAVE',
      AUTO_APPROVE_LEAVES: 'LEAVE',
      FY_LEAVE_CONFIG_REMINDER: 'NOTIFICATION',
      LEAVE_APPROVAL_REMINDER: 'NOTIFICATION',
      MONTHLY_LEAVE_ACCRUAL: 'LEAVE',
      CARD_EXPIRY_ALERT: 'CARD',
      ASSET_CALIBRATION_EXPIRY_ALERT: 'ASSET',
      ASSET_WARRANTY_EXPIRY_ALERT: 'ASSET',
      VEHICLE_DOCUMENT_EXPIRY_ALERT: 'VEHICLE',
      VEHICLE_SERVICE_DUE_REMINDER: 'VEHICLE',
      PENDING_EXPENSE_REMINDER: 'EXPENSE',
      MONTHLY_PAYROLL_GENERATION: 'PAYROLL',
      CELEBRATION_WISHES: 'CELEBRATION',
      PUBLISH_SCHEDULED_ANNOUNCEMENTS: 'ANNOUNCEMENT',
      EXPIRE_ANNOUNCEMENTS: 'ANNOUNCEMENT',
      DAILY_MIDNIGHT_ORCHESTRATOR: 'ORCHESTRATOR',
      MONTHLY_AUTO_APPROVE_ORCHESTRATOR: 'ORCHESTRATOR',
      APRIL_1_FY_ORCHESTRATOR: 'ORCHESTRATOR',
    };
    return jobTypeMap[jobName] || 'OTHER';
  }

  private getJobKey(dto: TriggerCronDto): string {
    const { jobName, date, month, year } = dto;
    return `${jobName}_${date || ''}_${month || ''}_${year || ''}`;
  }

  private getExecutionParameters(dto: TriggerCronDto): Record<string, any> {
    const params: Record<string, any> = {};
    if (dto.date) params.date = dto.date;
    if (dto.month) params.month = dto.month;
    if (dto.year) params.year = dto.year;
    if (dto.userId) params.userId = dto.userId;
    return params;
  }
}
