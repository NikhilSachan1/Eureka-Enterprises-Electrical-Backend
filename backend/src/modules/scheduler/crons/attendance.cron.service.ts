import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import {
  CRON_SCHEDULES,
  CRON_NAMES,
  SYSTEM_NOTES,
  SYSTEM_DEFAULTS,
} from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  AttendanceStatus,
  ApprovalStatus,
  AttendanceType,
} from '../../attendance/constants/attendance.constants';
import { ApprovalStatus as LeaveApprovalStatus } from '../../leave-applications/constants/leave-application.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
  EntrySourceType,
} from '../../../utils/master-constants/master-constants';
import { UserStatus } from '../../users/constants/user.constants';
import { UtilityService } from '../../../utils/utility/utility.service';
import {
  DailyAttendanceResult,
  EndOfDayAttendanceResult,
  AutoApproveAttendanceResult,
  AttendanceApprovalReminderResult,
  PendingAttendanceAlert,
  AttendanceApprovalEmailItem,
  AttendanceStatusSummary,
} from '../types';
import { EmailService } from '../../common/email/email.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../../common/email/constants/email.constants';
import { Environments } from '../../../../env-configs';
import {
  getActiveUsersForAttendanceQuery,
  getExistingAttendanceUserIdsQuery,
  getUserLeavesForDateQuery,
  getCheckedInAttendancesQuery,
  getNotCheckedInAttendancesQuery,
  getUsersWithoutAttendanceQuery,
  getPendingAttendancesForPeriodQuery,
  getPendingAttendanceForCurrentMonthQuery,
  getPendingAttendanceByStatusQuery,
  autoApproveAttendanceQuery,
} from '../queries';
import { DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD } from '../constants/scheduler.constants';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly attendanceService: AttendanceService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly emailService: EmailService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 1
   * Daily Attendance Entry Creation
   * Runs at 12:00 AM IST (6:30 PM UTC previous day)
   *
   * Creates attendance records for all active employees:
   * - HOLIDAY: If today is a holiday
   * - LEAVE: If user has approved/pending paid leave
   * - LEAVE_WITHOUT_PAY: If user has approved/pending LWP
   * - NOT_CHECKED_IN_YET: Default for all other users
   */
  @Cron(CRON_SCHEDULES.DAILY_MIDNIGHT_IST)
  async handleDailyAttendanceEntry(): Promise<DailyAttendanceResult | null> {
    const cronName = CRON_NAMES.DAILY_ATTENDANCE_ENTRY;

    return this.cronLogService.execute(cronName, CronJobType.ATTENDANCE, async () => {
      const result: DailyAttendanceResult = {
        totalUsers: 0,
        created: 0,
        skipped: 0,
        holidays: 0,
        leaves: 0,
        lwp: 0,
        errors: [],
      };

      const today = this.schedulerService.getTodayDateIST();
      const financialYear = this.utilityService.getFinancialYear(today);

      // 1. Check if today is a holiday
      const isHoliday = await this.isHolidayDate(today, financialYear);

      // 2. Get all active users who have joined
      const activeUsers = await this.getActiveUsersForAttendance(today);
      result.totalUsers = activeUsers.length;

      if (activeUsers.length === 0) {
        this.logger.log(`[${cronName}] No active users found for attendance`);
        return result;
      }

      // 3. Get users who have leaves for today
      const userLeaveMap = await this.getUserLeavesForDate(
        activeUsers.map((user) => user.id),
        today,
      );

      // 4. Get existing attendance records for today (to skip duplicates)
      const existingAttendanceUserIds = await this.getExistingAttendanceUserIds(today);

      // 5. Create attendance records
      await this.dataSource.transaction(async (entityManager) => {
        for (const user of activeUsers) {
          try {
            // Skip if attendance already exists
            if (existingAttendanceUserIds.has(user.id)) {
              result.skipped++;
              continue;
            }

            const leaveInfo = userLeaveMap.get(user.id);
            const attendanceData = this.buildAttendanceRecord(user.id, today, isHoliday, leaveInfo);

            await this.attendanceService.create(attendanceData, entityManager);
            result.created++;

            // Track by type
            if (attendanceData.status === AttendanceStatus.HOLIDAY) {
              result.holidays++;
            } else if (attendanceData.status === AttendanceStatus.LEAVE) {
              result.leaves++;
            } else if (attendanceData.status === AttendanceStatus.LEAVE_WITHOUT_PAY) {
              result.lwp++;
            }
          } catch (error) {
            result.errors.push(`User ${user.id}: ${error.message}`);
            this.logger.error(`[${cronName}] Error creating attendance for user ${user.id}`, error);
          }
        }
      });

      return result;
    });
  }

  private async isHolidayDate(date: Date, financialYear: string): Promise<boolean> {
    try {
      const holidayCalendarConfig = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.LEAVE,
          key: CONFIGURATION_KEYS.HOLIDAY_CALENDAR,
        },
      });

      if (!holidayCalendarConfig) {
        return false;
      }

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: holidayCalendarConfig.id,
          contextKey: financialYear,
          isActive: true,
        },
      });

      if (!configSetting?.value?.holidays) {
        return false;
      }

      const dateString = date.toISOString().split('T')[0];
      const holidays: Array<{ date: string }> = configSetting.value.holidays;

      return holidays.some((holiday) => holiday.date === dateString);
    } catch (error) {
      this.logger.warn('Error checking holiday calendar', error);
      return false;
    }
  }

  private async getActiveUsersForAttendance(
    today: Date,
  ): Promise<Array<{ id: string; dateOfJoining: Date }>> {
    const { query, params } = getActiveUsersForAttendanceQuery(UserStatus.ACTIVE, today);
    return await this.dataSource.query(query, params);
  }

  private async getUserLeavesForDate(
    userIds: string[],
    date: Date,
  ): Promise<Map<string, { leaveCategory: string; approvalStatus: string }>> {
    const { query, params } = getUserLeavesForDateQuery(userIds, date);
    const leaves = await this.dataSource.query(query, params);
    return new Map(
      leaves.map((leave: { userId: string; leaveCategory: string; approvalStatus: string }) => [
        leave.userId,
        { leaveCategory: leave.leaveCategory, approvalStatus: leave.approvalStatus },
      ]),
    );
  }

  private async getExistingAttendanceUserIds(date: Date): Promise<Set<string>> {
    const { query, params } = getExistingAttendanceUserIdsQuery(date);
    const existing = await this.dataSource.query(query, params);
    return new Set(existing.map((attendance: { userId: string }) => attendance.userId));
  }

  private buildAttendanceRecord(
    userId: string,
    date: Date,
    isHoliday: boolean,
    leaveInfo?: { leaveCategory: string; approvalStatus: string },
  ): Partial<any> {
    const baseRecord = {
      userId,
      attendanceDate: date,
      checkInTime: null,
      checkOutTime: null,
      entrySourceType: EntrySourceType.SYSTEM,
      attendanceType: AttendanceType.SYSTEM,
      isActive: true,
    };

    // Priority 1: Holiday
    if (isHoliday) {
      return {
        ...baseRecord,
        status: AttendanceStatus.HOLIDAY,
        approvalStatus: null,
        notes: SYSTEM_NOTES.HOLIDAY,
      };
    }

    // Priority 2: Leave (check if LWP or paid leave)
    if (leaveInfo) {
      const isLWP = this.isLeaveWithoutPay(leaveInfo.leaveCategory);
      const attendanceApprovalStatus =
        leaveInfo.approvalStatus === LeaveApprovalStatus.APPROVED
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.PENDING;

      return {
        ...baseRecord,
        status: isLWP ? AttendanceStatus.LEAVE_WITHOUT_PAY : AttendanceStatus.LEAVE,
        approvalStatus: attendanceApprovalStatus,
        notes: SYSTEM_NOTES.LEAVE.replace('{leaveCategory}', leaveInfo.leaveCategory),
      };
    }

    // Default: Not checked in yet (no notes, no approval status)
    return {
      ...baseRecord,
      status: AttendanceStatus.NOT_CHECKED_IN_YET,
      approvalStatus: null,
      notes: null,
    };
  }

  private isLeaveWithoutPay(leaveCategory: string): boolean {
    const lwpCategories = ['LWP', 'LEAVE_WITHOUT_PAY', 'UNPAID', 'UNPAID_LEAVE'];
    return lwpCategories.includes(leaveCategory.toUpperCase());
  }

  /**
   * CRON 2
   * End of Day Attendance Finalization
   * Runs at 7:00 PM IST (1:30 PM UTC) - after typical shift end
   *
   * Actions:
   * 1. Auto-checkout users who forgot to checkout (CHECKED_IN → CHECKED_OUT)
   * 2. Mark absent users who never checked in (NOT_CHECKED_IN_YET → ABSENT)
   * 3. Create ABSENT records for users added after morning cron
   */
  @Cron(CRON_SCHEDULES.DAILY_SHIFT_END_IST)
  async handleEndOfDayAttendance(): Promise<EndOfDayAttendanceResult | null> {
    const cronName = CRON_NAMES.END_OF_DAY_ATTENDANCE;

    return this.cronLogService.execute(cronName, CronJobType.ATTENDANCE, async () => {
      const result: EndOfDayAttendanceResult = {
        autoCheckouts: 0,
        markedAbsent: 0,
        newAbsentRecords: 0,
        errors: [],
      };

      const today = this.schedulerService.getTodayDateIST();

      // Get shift end time from config
      const shiftEndTime = await this.getShiftEndTime(today);

      await this.dataSource.transaction(async (entityManager) => {
        // 1. Auto-checkout users who forgot to checkout
        const autoCheckoutResult = await this.autoCheckoutForgottenUsers(
          today,
          shiftEndTime,
          entityManager,
        );
        result.autoCheckouts = autoCheckoutResult.count;
        result.errors.push(...autoCheckoutResult.errors);

        // 2. Mark absent users who never checked in
        const markAbsentResult = await this.markAbsentNotCheckedInUsers(today, entityManager);
        result.markedAbsent = markAbsentResult.count;
        result.errors.push(...markAbsentResult.errors);

        // 3. Create ABSENT records for users added after morning cron
        const newAbsentResult = await this.createAbsentForMissingUsers(today, entityManager);
        result.newAbsentRecords = newAbsentResult.count;
        result.errors.push(...newAbsentResult.errors);
      });

      return result;
    });
  }

  private async getShiftEndTime(today: Date): Promise<Date> {
    try {
      const shiftConfig = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.ATTENDANCE,
          key: CONFIGURATION_KEYS.SHIFT_CONFIGS,
        },
        relations: { configSettings: true },
      });

      if (!shiftConfig?.configSettings?.[0]?.value?.endTime) {
        this.logger.error('Shift end time not found in config');
        throw new Error('Shift end time not found in config');
      }

      const endTimeStr = shiftConfig.configSettings[0].value.endTime;
      const [hours, minutes] = endTimeStr.split(':').map(Number);

      const shiftEndTime = new Date(today);
      shiftEndTime.setUTCHours(hours, minutes, 0, 0);

      return shiftEndTime;
    } catch (error) {
      this.logger.error('Error fetching shift config', error);
      throw error;
    }
  }

  private async autoCheckoutForgottenUsers(
    today: Date,
    shiftEndTime: Date,
    entityManager: any,
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    const { query, params } = getCheckedInAttendancesQuery(today);
    const checkedInRecords: Array<{
      id: string;
      userId: string;
      checkInTime: Date;
      shiftConfigId: string;
      approvalStatus: string;
      notes: string | null;
    }> = await this.dataSource.query(query, params);

    for (const record of checkedInRecords) {
      try {
        if (record.approvalStatus === ApprovalStatus.REJECTED) {
          continue;
        }

        const updateData: Partial<any> = {
          checkOutTime: shiftEndTime,
          status: AttendanceStatus.CHECKED_OUT,
          notes: this.appendNote(record.notes, SYSTEM_NOTES.AUTO_CHECKOUT),
        };

        // Only set approvalStatus to PENDING if not already APPROVED
        if (record.approvalStatus !== ApprovalStatus.APPROVED) {
          updateData.approvalStatus = ApprovalStatus.PENDING;
        }

        await this.attendanceService.update({ id: record.id }, updateData, entityManager);
        count++;
      } catch (error) {
        errors.push(`Auto-checkout failed for attendance ${record.id}: ${error.message}`);
        this.logger.error(`Auto-checkout failed for attendance ${record.id}`, error);
      }
    }

    return { count, errors };
  }

  private async markAbsentNotCheckedInUsers(
    today: Date,
    entityManager: any,
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    const { query, params } = getNotCheckedInAttendancesQuery(today);
    const notCheckedInRecords: Array<{
      id: string;
      userId: string;
      notes: string | null;
    }> = await this.dataSource.query(query, params);

    for (const record of notCheckedInRecords) {
      try {
        await this.attendanceService.update(
          { id: record.id },
          {
            status: AttendanceStatus.ABSENT,
            approvalStatus: ApprovalStatus.PENDING,
            notes: this.appendNote(record.notes, SYSTEM_NOTES.MARKED_ABSENT),
          },
          entityManager,
        );
        count++;
      } catch (error) {
        errors.push(`Mark absent failed for attendance ${record.id}: ${error.message}`);
        this.logger.error(`Mark absent failed for attendance ${record.id}`, error);
      }
    }

    return { count, errors };
  }

  private appendNote(existingNotes: string | null, newNote: string): string {
    if (!existingNotes) {
      return newNote;
    }
    return `${existingNotes} / ${newNote}`;
  }

  private async createAbsentForMissingUsers(
    today: Date,
    entityManager: any,
  ): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    const { query, params } = getUsersWithoutAttendanceQuery(UserStatus.ACTIVE, today);
    const usersWithoutAttendance: Array<{ id: string }> = await this.dataSource.query(
      query,
      params,
    );

    for (const user of usersWithoutAttendance) {
      try {
        await this.attendanceService.create(
          {
            userId: user.id,
            attendanceDate: today,
            checkInTime: null,
            checkOutTime: null,
            status: AttendanceStatus.ABSENT,
            approvalStatus: ApprovalStatus.PENDING,
            entrySourceType: EntrySourceType.SYSTEM,
            attendanceType: AttendanceType.SYSTEM,
            notes: SYSTEM_NOTES.MARKED_ABSENT,
            isActive: true,
          },
          entityManager,
        );
        count++;
      } catch (error) {
        errors.push(`Create absent failed for user ${user.id}: ${error.message}`);
        this.logger.error(`Create absent failed for user ${user.id}`, error);
      }
    }

    return { count, errors };
  }

  /**
   * CRON 21: Auto Approve Pending Attendance
   * Runs on 1st of every month at 12:00 AM IST (before payroll generation)
   *
   * Auto-approves all pending attendance records for the previous month.
   * This ensures attendance is counted in payroll even if admin forgot to approve.
   *
   * Scenarios Handled:
   * 1. ABSENT with PENDING approval - Auto-approved
   * 2. CHECKED_OUT with PENDING approval - Auto-approved
   * 3. HALF_DAY with PENDING approval - Auto-approved
   * 4. LEAVE/LEAVE_WITHOUT_PAY with PENDING approval - Auto-approved
   * 5. Already APPROVED/REJECTED records - Skipped
   *
   * Timing:
   * - Runs at midnight on 1st of every month (same time as leave auto-approve)
   * - Runs BEFORE payroll generation (payroll runs at 1 AM on 2nd)
   * - Only processes previous month's attendance records
   *
   * Note: This runs at same schedule as leave auto-approve (CRON 6).
   * Both are independent and can run in parallel.
   */
  @Cron(CRON_SCHEDULES.MONTHLY_FIRST_MIDNIGHT_IST)
  async handleAutoApproveAttendance(): Promise<AutoApproveAttendanceResult | null> {
    const cronName = CRON_NAMES.AUTO_APPROVE_ATTENDANCE;

    return this.cronLogService.execute(cronName, CronJobType.ATTENDANCE, async () => {
      const result: AutoApproveAttendanceResult = {
        attendanceApproved: 0,
        byStatus: {
          absent: 0,
          checkedOut: 0,
          halfDay: 0,
          leave: 0,
          leaveWithoutPay: 0,
          other: 0,
        },
        errors: [],
      };

      const currentDate = this.schedulerService.getCurrentDateIST();

      const { startDate, endDate } = this.getPreviousMonthDateRange(currentDate);

      this.logger.log(
        `[${cronName}] Auto-approving pending attendance from ${startDate} to ${endDate}`,
      );

      const pendingAttendances = await this.getPendingAttendancesForPeriod(startDate, endDate);

      if (pendingAttendances.length === 0) {
        this.logger.log(`[${cronName}] No pending attendance found for previous month`);
        return result;
      }

      this.logger.log(
        `[${cronName}] Found ${pendingAttendances.length} pending attendance records to auto-approve`,
      );

      await this.dataSource.transaction(async (entityManager) => {
        for (const attendance of pendingAttendances) {
          try {
            const { query, params } = autoApproveAttendanceQuery(
              attendance.id,
              attendance.status,
              SYSTEM_NOTES.AUTO_APPROVED_ATTENDANCE,
              SYSTEM_DEFAULTS.SYSTEM_USER_ID,
            );
            await entityManager.query(query, params);

            result.attendanceApproved++;
            this.trackAttendanceByStatus(result.byStatus, attendance.status);

            const statusChanged =
              attendance.status === AttendanceStatus.CHECKED_OUT ||
              attendance.status === AttendanceStatus.HALF_DAY;
            const newStatus = statusChanged ? AttendanceStatus.PRESENT : attendance.status;

            this.logger.debug(
              `[${cronName}] Auto-approved attendance ${attendance.id} (${attendance.status} → ${newStatus})`,
            );
          } catch (error) {
            result.errors.push(`Failed to approve attendance ${attendance.id}: ${error.message}`);
            this.logger.error(`[${cronName}] Failed to approve attendance ${attendance.id}`, error);
          }
        }
      });

      this.logger.log(
        `[${cronName}] Summary: ${result.attendanceApproved} approved ` +
          `(Absent: ${result.byStatus.absent}, CheckedOut: ${result.byStatus.checkedOut}, ` +
          `HalfDay: ${result.byStatus.halfDay}, Leave: ${result.byStatus.leave}, ` +
          `LWP: ${result.byStatus.leaveWithoutPay}, Other: ${result.byStatus.other})`,
      );

      return result;
    });
  }

  private getPreviousMonthDateRange(currentDate: Date): { startDate: string; endDate: string } {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }

    const startDate = new Date(prevYear, prevMonth, 1);
    const endDate = new Date(year, month, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  private async getPendingAttendancesForPeriod(
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string; userId: string; status: string }>> {
    const { query, params } = getPendingAttendancesForPeriodQuery(startDate, endDate);
    return await this.dataSource.query(query, params);
  }

  private trackAttendanceByStatus(
    byStatus: AutoApproveAttendanceResult['byStatus'],
    status: string,
  ): void {
    switch (status) {
      case AttendanceStatus.ABSENT:
        byStatus.absent++;
        break;
      case AttendanceStatus.CHECKED_OUT:
        byStatus.checkedOut++;
        break;
      case AttendanceStatus.HALF_DAY:
        byStatus.halfDay++;
        break;
      case AttendanceStatus.LEAVE:
        byStatus.leave++;
        break;
      case AttendanceStatus.LEAVE_WITHOUT_PAY:
        byStatus.leaveWithoutPay++;
        break;
      default:
        byStatus.other++;
        break;
    }
  }

  /**
   * CRON 22: Attendance Approval Reminder
   * Runs daily at 9:00 AM IST from 25th to end of month
   *
   * Sends reminder emails to HR/Admin about pending attendance records
   * that will be auto-approved on the 1st of next month if not actioned.
   *
   * Scenarios Handled:
   * 1. Only runs from 25th to last day of month (reminder window)
   * 2. Groups attendance by status (ABSENT, CHECKED_OUT, HALF_DAY, LEAVE)
   * 3. Shows countdown to auto-approval date
   * 4. Different urgency levels: critical (1 day), urgent (2-3 days), normal (4+ days)
   * 5. Highlights ABSENT records as they need special review
   * 6. Only considers attendance for current month
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleAttendanceApprovalReminder(): Promise<AttendanceApprovalReminderResult | null> {
    const cronName = CRON_NAMES.ATTENDANCE_APPROVAL_REMINDER;

    // Check if in reminder window first (before logging to DB)
    const currentDate = this.schedulerService.getCurrentDateIST();
    const currentDay = currentDate.getDate();

    if (currentDay < 25) {
      this.logger.log(`[${cronName}] Skipping - not in reminder window (day ${currentDay})`);
      return null;
    }

    return this.cronLogService.execute(cronName, CronJobType.NOTIFICATION, async () => {
      const result: AttendanceApprovalReminderResult = {
        emailsSent: 0,
        totalPendingAttendance: 0,
        recipients: [],
        errors: [],
      };

      const { startDate, endDate, daysUntilAutoApproval, autoApprovalDate, monthName } =
        this.getAttendanceMonthInfo(currentDate);

      const pendingAttendance = await this.getPendingAttendanceForMonth(startDate, endDate);

      if (pendingAttendance.length === 0) {
        this.logger.log(`[${cronName}] No pending attendance found for ${monthName}`);
        return result;
      }

      result.totalPendingAttendance = pendingAttendance.length;
      this.logger.log(
        `[${cronName}] Found ${pendingAttendance.length} pending attendance for ${monthName}`,
      );

      const statusSummaries = await this.getAttendanceStatusSummary(startDate, endDate);
      const thresholdDays = await this.getAttendanceApprovalReminderThreshold();
      const { urgentAttendance, regularAttendance } = this.formatAttendanceForEmail(
        pendingAttendance,
        thresholdDays,
      );
      const urgencyLevel = this.getAttendanceUrgencyLevel(daysUntilAutoApproval);
      const hrEmails = await this.getHRAdminEmailsForAttendance();

      if (hrEmails.length === 0) {
        this.logger.warn(`[${cronName}] No HR/Admin emails found to send reminder`);
        return result;
      }

      const emailData = {
        totalPending: pendingAttendance.length,
        totalUrgent: urgentAttendance.length,
        daysUntilAutoApproval,
        urgencyLevel,
        statusSummaries,
        urgentAttendance,
        pendingAttendance: regularAttendance,
        hasUrgent: urgentAttendance.length > 0,
        hasPending: regularAttendance.length > 0,
        autoApprovalDate,
        monthName,
        adminPortalUrl: Environments.FE_BASE_URL || '#',
        currentYear: currentDate.getFullYear(),
      };

      const subject = this.getAttendanceReminderSubject(urgencyLevel, daysUntilAutoApproval);

      for (const email of hrEmails) {
        try {
          await this.emailService.sendMail({
            receiverEmails: email,
            subject,
            template: EMAIL_TEMPLATE.ATTENDANCE_APPROVAL_REMINDER,
            emailData,
          });

          this.logger.log(`[${cronName}] Email sent to: ${email}`);
          result.recipients.push(email);
          result.emailsSent++;
        } catch (error) {
          result.errors.push(`Failed to send email to ${email}: ${error.message}`);
          this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
        }
      }

      return result;
    });
  }

  private getAttendanceMonthInfo(currentDate: Date): {
    startDate: string;
    endDate: string;
    daysUntilAutoApproval: number;
    autoApprovalDate: string;
    monthName: string;
  } {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const nextMonth = new Date(year, month + 1, 1);

    const today = new Date(year, month, currentDate.getDate());
    const daysUntilAutoApproval = Math.ceil(
      (nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      daysUntilAutoApproval,
      autoApprovalDate: this.formatAttendanceDate(nextMonth),
      monthName: monthNames[month],
    };
  }

  private async getPendingAttendanceForMonth(
    startDate: string,
    endDate: string,
  ): Promise<PendingAttendanceAlert[]> {
    const { query, params } = getPendingAttendanceForCurrentMonthQuery(startDate, endDate);
    return await this.dataSource.query(query, params);
  }

  private async getAttendanceStatusSummary(
    startDate: string,
    endDate: string,
  ): Promise<AttendanceStatusSummary[]> {
    const { query, params } = getPendingAttendanceByStatusQuery(startDate, endDate);
    const results = await this.dataSource.query(query, params);

    return results.map((item: { status: string; count: number }) => ({
      status: item.status,
      count: item.count,
      displayName: this.getStatusDisplayName(item.status),
    }));
  }

  private getStatusDisplayName(status: string): string {
    const statusMap: Record<string, string> = {
      [AttendanceStatus.ABSENT]: 'Absent',
      [AttendanceStatus.CHECKED_OUT]: 'Checked Out',
      [AttendanceStatus.HALF_DAY]: 'Half Day',
      [AttendanceStatus.LEAVE]: 'Leave',
      [AttendanceStatus.LEAVE_WITHOUT_PAY]: 'LWP',
      [AttendanceStatus.CHECKED_IN]: 'Checked In',
      [AttendanceStatus.PRESENT]: 'Present',
    };
    return statusMap[status] || status;
  }

  private formatAttendanceForEmail(
    attendance: PendingAttendanceAlert[],
    thresholdDays: number,
  ): {
    urgentAttendance: AttendanceApprovalEmailItem[];
    regularAttendance: AttendanceApprovalEmailItem[];
  } {
    const urgentAttendance: AttendanceApprovalEmailItem[] = [];
    const regularAttendance: AttendanceApprovalEmailItem[] = [];
    const today = new Date();

    for (const record of attendance) {
      const attendanceDate = new Date(record.attendanceDate);
      const daysPending = Math.floor(
        (today.getTime() - attendanceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const isUrgent = record.status === AttendanceStatus.ABSENT || daysPending >= thresholdDays;
      const emailItem: AttendanceApprovalEmailItem = {
        employeeName: record.employeeName,
        attendanceDate: this.formatAttendanceDate(new Date(record.attendanceDate)),
        status: record.status,
        statusDisplayName: this.getStatusDisplayName(record.status),
        checkInTime: record.checkInTime ? this.formatTime(new Date(record.checkInTime)) : '-',
        checkOutTime: record.checkOutTime ? this.formatTime(new Date(record.checkOutTime)) : '-',
        notes: record.notes || 'No notes',
        statusClass: isUrgent ? 'urgent' : 'pending',
      };

      if (isUrgent) {
        urgentAttendance.push(emailItem);
      } else {
        regularAttendance.push(emailItem);
      }
    }

    return { urgentAttendance, regularAttendance };
  }

  private getAttendanceUrgencyLevel(
    daysUntilAutoApproval: number,
  ): 'critical' | 'urgent' | 'normal' {
    if (daysUntilAutoApproval <= 1) {
      return 'critical';
    } else if (daysUntilAutoApproval <= 3) {
      return 'urgent';
    }
    return 'normal';
  }

  private getAttendanceReminderSubject(
    urgencyLevel: 'critical' | 'urgent' | 'normal',
    daysUntilAutoApproval: number,
  ): string {
    switch (urgencyLevel) {
      case 'critical':
        return EMAIL_SUBJECT.ATTENDANCE_APPROVAL_REMINDER_CRITICAL;
      case 'urgent':
        return EMAIL_SUBJECT.ATTENDANCE_APPROVAL_REMINDER_URGENT.replace(
          '{days}',
          daysUntilAutoApproval.toString(),
        );
      default:
        return EMAIL_SUBJECT.ATTENDANCE_APPROVAL_REMINDER;
    }
  }

  private formatAttendanceDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    return date.toLocaleDateString('en-IN', options);
  }

  private formatTime(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    return date.toLocaleTimeString('en-IN', options);
  }

  private async getHRAdminEmailsForAttendance(): Promise<string[]> {
    // TODO: Implement dynamic email fetching from users with HR/ADMIN roles
    return ['hr@company.com'];
  }

  private async getAttendanceApprovalReminderThreshold(): Promise<number> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.ATTENDANCE,
          key: CONFIGURATION_KEYS.ATTENDANCE_APPROVAL_REMINDER_THRESHOLD_DAYS,
        },
      });

      if (!config) {
        return DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD;
      }

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: config.id,
          isActive: true,
        },
      });

      if (!configSetting?.value) {
        return DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD;
      }

      const threshold = Number(configSetting.value);
      return isNaN(threshold) ? DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD : threshold;
    } catch (error) {
      this.logger.warn(
        'Failed to fetch attendance approval reminder threshold, using default',
        error,
      );
      return DEFAULT_ATTENDANCE_APPROVAL_REMINDER_THRESHOLD;
    }
  }
}
