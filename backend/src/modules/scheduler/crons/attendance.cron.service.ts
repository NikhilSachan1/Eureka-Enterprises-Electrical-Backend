import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { AttendanceService } from '../../attendance/attendance.service';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import { CRON_SCHEDULES, CRON_NAMES, SYSTEM_NOTES } from '../constants/scheduler.constants';
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
import { DailyAttendanceResult } from '../types';
import {
  getActiveUsersForAttendanceQuery,
  getExistingAttendanceUserIdsQuery,
  getUserLeavesForDateQuery,
} from '../queries';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly attendanceService: AttendanceService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
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
  async handleDailyAttendanceEntry(): Promise<DailyAttendanceResult> {
    const cronName = CRON_NAMES.DAILY_ATTENDANCE_ENTRY;
    this.schedulerService.logCronStart(cronName);

    const result: DailyAttendanceResult = {
      totalUsers: 0,
      created: 0,
      skipped: 0,
      holidays: 0,
      leaves: 0,
      lwp: 0,
      errors: [],
    };

    try {
      const today = this.schedulerService.getTodayDateIST();
      const financialYear = this.utilityService.getFinancialYear(today);

      // 1. Check if today is a holiday
      const isHoliday = await this.isHolidayDate(today, financialYear);

      // 2. Get all active users who have joined
      const activeUsers = await this.getActiveUsersForAttendance(today);
      result.totalUsers = activeUsers.length;

      if (activeUsers.length === 0) {
        this.logger.log(`[${cronName}] No active users found for attendance`);
        this.schedulerService.logCronComplete(cronName, result);
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

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Check if a date is a holiday from the holiday calendar config
   */
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

  /**
   * Get all active users eligible for attendance
   */
  private async getActiveUsersForAttendance(
    today: Date,
  ): Promise<Array<{ id: string; dateOfJoining: Date }>> {
    const { query, params } = getActiveUsersForAttendanceQuery(UserStatus.ACTIVE, today);
    return await this.dataSource.query(query, params);
  }

  /**
   * Get leave applications for users on a specific date
   */
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

  /**
   * Get user IDs who already have attendance records for today
   */
  private async getExistingAttendanceUserIds(date: Date): Promise<Set<string>> {
    const { query, params } = getExistingAttendanceUserIdsQuery(date);
    const existing = await this.dataSource.query(query, params);
    return new Set(existing.map((attendance: { userId: string }) => attendance.userId));
  }

  /**
   * Build attendance record based on conditions
   */
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

  /**
   * Check if leave category is Leave Without Pay
   */
  private isLeaveWithoutPay(leaveCategory: string): boolean {
    const lwpCategories = ['LWP', 'LEAVE_WITHOUT_PAY', 'UNPAID', 'UNPAID_LEAVE'];
    return lwpCategories.includes(leaveCategory.toUpperCase());
  }
}
