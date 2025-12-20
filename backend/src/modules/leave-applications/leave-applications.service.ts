import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveApplicationsEntity } from './entities/leave-application.entity';
import {
  DataSource,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
} from 'typeorm';
import { LeaveApplicationsRepository } from './leave-applications.repository';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import {
  LEAVE_APPLICATION_ERRORS,
  LEAVE_APPLICATION_FIELD_NAMES,
  ApprovalStatus,
  LeaveType,
  LeaveApplicationType,
  LEAVE_APPLICATION_SUCCESS_MESSAGES,
  DEFAULT_APPROVAL_COMMENT,
} from './constants/leave-application.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
  LeaveCycleType,
} from 'src/utils/master-constants/master-constants';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  ForceLeaveApplicationDto,
  GetLeaveApplicationsDto,
  LeaveApplicationResponseDto,
  LeaveBulkApprovalDto,
  CreateLeaveApplicationDto,
  LeaveApprovalDto,
  LeaveGroupDto,
  UserLeaveGroupDto,
} from './dto';
import {
  buildLeaveApplicationCountQuery,
  buildLeaveApplicationListQuery,
  buildLeaveApplicationStatsQuery,
  buildUniqueUserIdsQuery,
} from './queries/leave-queries.dto';
import { UserService } from '../users/user.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class LeaveApplicationsService {
  constructor(
    private readonly leaveApplicationsRepository: LeaveApplicationsRepository,
    private readonly utilityService: UtilityService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly leaveBalanceService: LeaveBalancesService,
    private readonly attendanceService: AttendanceService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly userService: UserService,
  ) {}

  async create(
    leaveApplication: Partial<LeaveApplicationsEntity> | CreateLeaveApplicationDto,
    entityManager?: EntityManager,
  ): Promise<LeaveApplicationsEntity> {
    try {
      return await this.leaveApplicationsRepository.create(leaveApplication, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findOne(
    options: FindOneOptions<LeaveApplicationsEntity>,
  ): Promise<LeaveApplicationsEntity | null> {
    try {
      return await this.leaveApplicationsRepository.findOne(options);
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: FindManyOptions<LeaveApplicationsEntity>): Promise<{
    records: LeaveApplicationsEntity[];
    totalRecords: number;
  }> {
    return await this.leaveApplicationsRepository.findAll(options);
  }

  async findOneOrFail(
    options: FindOneOptions<LeaveApplicationsEntity>,
  ): Promise<LeaveApplicationsEntity> {
    try {
      const permission = await this.leaveApplicationsRepository.findOne(options);
      if (!permission) {
        throw new NotFoundException(LEAVE_APPLICATION_ERRORS.NOT_FOUND);
      }
      return permission;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<LeaveApplicationsEntity>,
    updateData: Partial<LeaveApplicationsEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: { id: identifierConditions.id } });
      await this.leaveApplicationsRepository.update(
        identifierConditions,
        updateData,
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        LEAVE_APPLICATION_FIELD_NAMES.LEAVE_APPLICATION,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  private async getLeaveCalendarSetting() {
    const leaveCalendarSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.LEAVE, key: CONFIGURATION_KEYS.CALENDAR_SETTINGS },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveCalendarSetting.id, isActive: true },
    });

    return configSetting;
  }

  private async validateLeaveType(leaveType: string, financialYear: string) {
    const leaveTypeSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.LEAVE, key: CONFIGURATION_KEYS.LEAVE_TYPES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveTypeSetting.id, contextKey: financialYear, isActive: true },
    });

    const isValidLeaveType = configSetting.value.some((item: any) => item.name === leaveType);

    if (!isValidLeaveType) {
      const availableLeaveTypes = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.LEAVE_TYPE_NOT_FOUND.replace(
          '{leaveTypes}',
          availableLeaveTypes.join(', '),
        ),
      );
    }
  }

  private async validateLeaveCategory(leaveCategory: string, financialYear: string) {
    const leaveCategorySetting = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.LEAVE,
        key: CONFIGURATION_KEYS.LEAVE_CATEGORIES,
      },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveCategorySetting.id, contextKey: financialYear, isActive: true },
    });
    const isValidLeaveCategory = configSetting.value.some(
      (item: any) => item.name === leaveCategory,
    );

    if (!isValidLeaveCategory) {
      const availableLeaveCategories = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.LEAVE_CATEGORY_NOT_FOUND.replace(
          '{leaveCategories}',
          availableLeaveCategories.join(', '),
        ),
      );
    }
  }

  private async validateLeaveBalance(
    userId: string,
    leaveCategory: string,
    financialYear: string,
    numberOfDays: number,
  ) {
    const leaveBalance = await this.leaveBalanceService.findOneOrFail({
      where: { userId, leaveCategory, financialYear },
    });

    const balance = parseFloat(leaveBalance.totalAllocated) - parseFloat(leaveBalance.consumed);

    if (balance < numberOfDays) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.LEAVE_BALANCE_EXHAUSTED.replace(
          '{leaveCategory}',
          leaveCategory,
        ).replace('{balance}', balance.toString()),
      );
    }

    return leaveBalance;
  }

  private calculateDaysBetween(fromDate: string, toDate: string): number {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    const timeDifference = endDate.getTime() - startDate.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1;

    return daysDifference;
  }

  private generateDateRange(fromDate: string, toDate: string): string[] {
    const dates: string[] = [];
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  private async validateHolidays(dates: string[], financialYear: string): Promise<void> {
    const holidayCalendarConfig = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.LEAVE, key: CONFIGURATION_KEYS.HOLIDAY_CALENDAR },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: holidayCalendarConfig.id, contextKey: financialYear, isActive: true },
    });

    const holidays = configSetting.value.holidays;

    for (const date of dates) {
      const isHoliday = holidays.some((holiday: any) => {
        if (typeof holiday === 'string') {
          return holiday === date;
        }
        if (typeof holiday === 'object' && holiday.date) {
          return holiday.date === date;
        }
        return false;
      });

      if (isHoliday) {
        throw new BadRequestException(
          LEAVE_APPLICATION_ERRORS.HOLIDAY_VALIDATION_ERROR.replace('{date}', date),
        );
      }
    }
  }

  private async validateLeaveDates(
    fromDate: string,
    toDate: string,
    cycleType: LeaveCycleType,
  ): Promise<{ financialYear: string; numberOfDays: number }> {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    const currentDate = new Date();

    if (startDate > endDate) {
      throw new BadRequestException(LEAVE_APPLICATION_ERRORS.FROM_DATE_GREATER_THAN_TO_DATE);
    }
    const numberOfDays = this.calculateDaysBetween(fromDate, toDate);
    if (cycleType === LeaveCycleType.FINANCIAL_YEAR) {
      const currentYear = currentDate.getFullYear();
      const financialYearStart = new Date(currentYear, 3, 1);
      const financialYearEnd = new Date(currentYear + 1, 2, 31);

      if (currentDate.getMonth() < 3) {
        financialYearStart.setFullYear(currentYear - 1);
        financialYearEnd.setFullYear(currentYear);
      }

      if (startDate < financialYearStart || endDate > financialYearEnd) {
        throw new BadRequestException(LEAVE_APPLICATION_ERRORS.LEAVE_OUTSIDE_FINANCIAL_YEAR);
      }

      return {
        financialYear: `${financialYearStart.getFullYear()}-${financialYearEnd.getFullYear()}`,
        numberOfDays,
      };
    } else if (cycleType === LeaveCycleType.CALENDAR_YEAR) {
      const currentYear = currentDate.getFullYear();
      const calendarYearStart = new Date(currentYear, 0, 1);
      const calendarYearEnd = new Date(currentYear, 11, 31);

      if (startDate < calendarYearStart || endDate > calendarYearEnd) {
        throw new BadRequestException(LEAVE_APPLICATION_ERRORS.LEAVE_OUTSIDE_CALENDAR_YEAR);
      }

      return {
        financialYear: currentYear.toString(),
        numberOfDays,
      };
    }
    throw new BadRequestException(LEAVE_APPLICATION_ERRORS.INVALID_CYCLE_TYPE);
  }

  private async validateLeaveApplication(
    leaveCategory: string,
    financialYear: string,
    leaveType: string,
    fromDate: string,
    numberOfDays: number,
  ) {
    const leaveCategoriesConfigSetting = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.LEAVE,
        key: CONFIGURATION_KEYS.LEAVE_CATEGORIES_CONFIG,
      },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: {
        configId: leaveCategoriesConfigSetting.id,
        contextKey: financialYear,
        isActive: true,
      },
    });

    const categoryConfig = configSetting.value[leaveCategory];
    if (!categoryConfig) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.LEAVE_CATEGORY_DOES_NOT_EXIST.replace(
          '{leaveCategory}',
          leaveCategory,
        ),
      );
    }

    const config = categoryConfig.actual || categoryConfig.default;
    if (!config) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.CONFIGURATION_NOT_FOUND.replace('{leaveCategory}', leaveCategory),
      );
    }

    if (leaveType === LeaveType.HALF_DAY && !config.allowHalfDay) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.HALF_DAY_LEAVE_NOT_ALLOWED.replace(
          '{leaveCategory}',
          config.label,
        ),
      );
    }

    const fromDateObj = new Date(fromDate);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    fromDateObj.setHours(0, 0, 0, 0);

    if (fromDateObj < currentDate && !config.allowBackwardApply) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.BACKWARD_LEAVE_NOT_ALLOWED.replace(
          '{leaveCategory}',
          config.label,
        ),
      );
    }

    if (config.applyBeforeDays > 0) {
      const daysDifference = Math.ceil(
        (fromDateObj.getTime() - currentDate.getTime()) / (1000 * 3600 * 24),
      );

      if (daysDifference < config.applyBeforeDays) {
        throw new BadRequestException(
          LEAVE_APPLICATION_ERRORS.MINIMUM_DAYS_BEFORE_APPLYING.replace(
            '{leaveCategory}',
            config.label,
          ).replace('{applyBeforeDays}', config.applyBeforeDays.toString()),
        );
      }
    }

    if (config.maxDays > 0) {
      if (numberOfDays > config.maxDays) {
        throw new BadRequestException(
          LEAVE_APPLICATION_ERRORS.MAX_DAYS_EXCEEDED.replace(
            '{maxDays}',
            config.maxDays.toString(),
          ),
        );
      }
    }

    return config;
  }

  async applyLeave({
    userId,
    leaveType,
    leaveCategory,
    fromDate,
    toDate,
    reason,
    leaveApplicationType,
    createdBy,
    entrySourceType,
  }: CreateLeaveApplicationDto & {
    userId: string;
    leaveApplicationType: LeaveApplicationType;
    createdBy: string;
  }) {
    try {
      const {
        id: leaveConfigId,
        value: { cycleType },
      } = await this.getLeaveCalendarSetting();
      const { financialYear, numberOfDays } = await this.validateLeaveDates(
        fromDate,
        toDate,
        cycleType,
      );
      await this.validateLeaveType(leaveType, financialYear);
      await this.validateLeaveCategory(leaveCategory, financialYear);

      const dateRange = this.generateDateRange(fromDate, toDate);
      await this.validateHolidays(dateRange, financialYear);

      await this.validateLeaveApplication(
        leaveCategory,
        financialYear,
        leaveType,
        fromDate,
        numberOfDays,
      );
      const leaveBalance = await this.validateLeaveBalance(
        userId,
        leaveCategory,
        financialYear,
        numberOfDays,
      );

      await this.dataSource.transaction(async (entityManager) => {
        for (const date of dateRange) {
          const existingLeaveApplication = await this.findOne({
            where: {
              userId,
              leaveCategory,
              fromDate: new Date(date),
              toDate: new Date(date),
            },
          });

          if (existingLeaveApplication) {
            throw new BadRequestException(
              LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_ALREADY_EXISTS.replace(
                '{fromDate}',
                date,
              ).replace('{toDate}', date),
            );
          }
        }

        const leaveApplicationPromises = dateRange.map((date) => {
          const leaveApplicationData = {
            userId,
            leaveType,
            leaveCategory,
            leaveConfigId,
            fromDate: new Date(date),
            toDate: new Date(date),
            reason,
            approvalStatus: ApprovalStatus.PENDING,
            leaveApplicationType,
            entrySourceType,
            createdBy,
          };

          return this.create(leaveApplicationData, entityManager);
        });

        // Wait for all leave applications to be created
        await Promise.all(leaveApplicationPromises);

        // Update leave balance
        const updateLeaveBalanceData = {
          identifierConditions: {
            userId,
            leaveCategory,
            financialYear,
          },
          updatedData: {
            consumed: (parseFloat(leaveBalance.consumed) + numberOfDays).toString(),
          },
        };

        await this.leaveBalanceService.update(
          updateLeaveBalanceData.identifierConditions,
          updateLeaveBalanceData.updatedData,
          entityManager,
        );
      });

      return this.utilityService.getSuccessMessage(
        LEAVE_APPLICATION_FIELD_NAMES.LEAVE_APPLICATION,
        DataSuccessOperationType.CREATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async forceLeaveApplication({
    userId,
    leaveType,
    leaveCategory,
    fromDate,
    toDate,
    reason,
    leaveApplicationType,
    createdBy,
    entrySourceType,
    approvalReason,
  }: ForceLeaveApplicationDto & {
    leaveApplicationType: LeaveApplicationType;
    createdBy: string;
  }) {
    try {
      await this.userService.findOneOrFail({ where: { id: userId } });
      const {
        id: leaveConfigId,
        value: { cycleType },
      } = await this.getLeaveCalendarSetting();
      const { financialYear, numberOfDays } = await this.validateLeaveDates(
        fromDate,
        toDate,
        cycleType,
      );
      await this.validateLeaveType(leaveType, financialYear);
      await this.validateLeaveCategory(leaveCategory, financialYear);
      const dateRange = this.generateDateRange(fromDate, toDate);
      await this.validateHolidays(dateRange, financialYear);

      await this.validateLeaveApplication(
        leaveCategory,
        financialYear,
        leaveType,
        fromDate,
        numberOfDays,
      );

      const leaveBalance = await this.validateLeaveBalance(
        userId,
        leaveCategory,
        financialYear,
        numberOfDays,
      );

      await this.dataSource.transaction(async (entityManager) => {
        for (const date of dateRange) {
          const existingLeaveApplication = await this.findOne({
            where: {
              userId,
              leaveCategory,
              fromDate: new Date(date),
              toDate: new Date(date),
            },
          });

          if (existingLeaveApplication) {
            throw new BadRequestException(
              LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_ALREADY_EXISTS.replace(
                '{fromDate}',
                date,
              ).replace('{toDate}', date),
            );
          }
        }

        const leaveApplicationPromises = dateRange.map((date) => {
          const leaveApplicationData = {
            userId,
            leaveType,
            leaveCategory,
            leaveConfigId,
            fromDate: new Date(date),
            toDate: new Date(date),
            reason,
            approvalStatus: ApprovalStatus.APPROVED,
            approvalAt: new Date(),
            approvalBy: createdBy,
            approvalReason,
            leaveApplicationType,
            entrySourceType,
            createdBy,
          };

          return this.create(leaveApplicationData, entityManager);
        });

        await Promise.all(leaveApplicationPromises);

        const updateLeaveBalanceData = {
          identifierConditions: {
            userId,
            leaveCategory,
            financialYear,
          },
          updatedData: {
            consumed: (parseFloat(leaveBalance.consumed) + numberOfDays).toString(),
          },
        };

        await this.leaveBalanceService.update(
          updateLeaveBalanceData.identifierConditions,
          updateLeaveBalanceData.updatedData,
          entityManager,
        );
      });

      return this.utilityService.getSuccessMessage(
        LEAVE_APPLICATION_FIELD_NAMES.LEAVE_APPLICATION,
        DataSuccessOperationType.CREATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async getLeaveApplications(
    filters: GetLeaveApplicationsDto,
  ): Promise<
    | { records: LeaveApplicationResponseDto[]; totalRecords: number; stats: any }
    | { groupedRecords: UserLeaveGroupDto[] | LeaveGroupDto[]; totalRecords: number; stats: any }
  > {
    // Build all queries
    const { query, params } = buildLeaveApplicationListQuery(filters);
    const { query: countQuery, params: countParams } = buildLeaveApplicationCountQuery(filters);
    const { query: statsQuery, params: statsParams } = buildLeaveApplicationStatsQuery(filters);
    const { query: uniqueUsersQuery, params: uniqueUsersParams } = buildUniqueUserIdsQuery(filters);

    // Execute all queries in parallel
    const [records, totalRecordsResult, statsResults, uniqueUserResults] = await Promise.all([
      this.leaveApplicationsRepository.rawQuery(query, params),
      this.leaveApplicationsRepository.rawQuery(countQuery, countParams),
      this.leaveApplicationsRepository.rawQuery(statsQuery, statsParams),
      this.leaveApplicationsRepository.rawQuery(uniqueUsersQuery, uniqueUsersParams),
    ]);

    const transformedRecords = this.transformLeaveApplicationRecords(records);
    const totalRecords = totalRecordsResult[0]?.total || 0;

    // Get unique user IDs from the filtered results (not just current page)
    const uniqueUserIds = uniqueUserResults.map((row) => row.userId);

    let leaveBalances = [];
    if (uniqueUserIds.length > 0) {
      const leaveBalanceResult = await this.leaveBalanceService.findAll({
        where: {
          userId: In(uniqueUserIds),
          financialYear: filters.financialYear,
        },
      });
      leaveBalances = leaveBalanceResult.records;
    }

    const transformedLeaveBalances = this.transformLeaveBalanceRecords(leaveBalances);
    const stats = this.calculateStatsFromResults(statsResults, transformedLeaveBalances);

    const grouped = filters.grouped !== false;

    if (grouped) {
      const isSingleUser = filters.userIds && filters.userIds.length === 1;
      const groupedRecords = this.groupLeaveApplications(transformedRecords, isSingleUser);

      return {
        stats,
        groupedRecords,
        totalRecords: parseInt(totalRecords),
      };
    }

    return {
      stats,
      records: transformedRecords,
      totalRecords: parseInt(totalRecords),
    };
  }

  private groupLeaveApplications(
    records: LeaveApplicationResponseDto[],
    isSingleUser: boolean,
  ): UserLeaveGroupDto[] | LeaveGroupDto[] {
    if (records.length === 0) {
      return [];
    }

    const userGroups = new Map<string, LeaveApplicationResponseDto[]>();

    for (const record of records) {
      const userId = record.userId;
      if (!userGroups.has(userId)) {
        userGroups.set(userId, []);
      }
      userGroups.get(userId)!.push(record);
    }

    const result: UserLeaveGroupDto[] = [];

    for (const [userId, userRecords] of userGroups) {
      const leaveGroups = this.createLeaveGroups(userRecords);
      const firstRecord = userRecords[0];

      result.push({
        userId,
        user: firstRecord.user!,
        leaveGroups,
      });
    }

    result.sort((a, b) => {
      const aEarliest = a.leaveGroups[0]?.dateRange.from || '';
      const bEarliest = b.leaveGroups[0]?.dateRange.from || '';
      // Convert to string in case it's a Date object
      const aStr = typeof aEarliest === 'string' ? aEarliest : String(aEarliest);
      const bStr = typeof bEarliest === 'string' ? bEarliest : String(bEarliest);
      return bStr.localeCompare(aStr);
    });

    if (isSingleUser && result.length === 1) {
      return result[0].leaveGroups;
    }

    return result;
  }

  private createLeaveGroups(records: LeaveApplicationResponseDto[]): LeaveGroupDto[] {
    if (records.length === 0) {
      return [];
    }

    const sortedRecords = [...records].sort((a, b) => {
      return new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime();
    });

    const groups: LeaveGroupDto[] = [];
    let currentGroup: LeaveApplicationResponseDto[] = [sortedRecords[0]];

    for (let i = 1; i < sortedRecords.length; i++) {
      const prevRecord = sortedRecords[i - 1];
      const currRecord = sortedRecords[i];

      if (this.shouldBeInSameGroup(prevRecord, currRecord)) {
        currentGroup.push(currRecord);
      } else {
        groups.push(this.finalizeGroup(currentGroup));
        currentGroup = [currRecord];
      }
    }

    if (currentGroup.length > 0) {
      groups.push(this.finalizeGroup(currentGroup));
    }

    groups.sort((a, b) => {
      return new Date(b.dateRange.from).getTime() - new Date(a.dateRange.from).getTime();
    });

    return groups;
  }

  private shouldBeInSameGroup(
    prev: LeaveApplicationResponseDto,
    curr: LeaveApplicationResponseDto,
  ): boolean {
    if (
      prev.approvalStatus !== curr.approvalStatus ||
      prev.leaveCategory !== curr.leaveCategory ||
      prev.leaveType !== curr.leaveType
    ) {
      return false;
    }

    const prevDate = new Date(prev.fromDate);
    const currDate = new Date(curr.fromDate);

    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays === 1;
  }

  private finalizeGroup(records: LeaveApplicationResponseDto[]): LeaveGroupDto {
    records.sort((a, b) => new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime());

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];

    const earliestCreatedAt = records.reduce((earliest, record) => {
      const recordDate = new Date(record.createdAt);
      return recordDate < earliest ? recordDate : earliest;
    }, new Date(firstRecord.createdAt));

    const fromDate =
      typeof firstRecord.fromDate === 'string'
        ? firstRecord.fromDate
        : new Date(firstRecord.fromDate).toISOString().split('T')[0];
    const toDate =
      typeof lastRecord.toDate === 'string'
        ? lastRecord.toDate
        : new Date(lastRecord.toDate).toISOString().split('T')[0];

    return {
      dateRange: {
        from: fromDate,
        to: toDate,
      },
      approvalStatus: firstRecord.approvalStatus,
      leaveCategory: firstRecord.leaveCategory,
      leaveType: firstRecord.leaveType,
      count: records.length,
      reason: firstRecord.reason,
      createdAt: earliestCreatedAt.toISOString(),
      records,
    };
  }

  private transformLeaveApplicationRecords(leaveApplications: any[]) {
    return leaveApplications.map((leaveApplication) => {
      return {
        id: leaveApplication.id,
        userId: leaveApplication.userId,
        leaveType: leaveApplication.leaveType,
        leaveCategory: leaveApplication.leaveCategory,
        leaveApplicationType: leaveApplication.leaveApplicationType,
        fromDate: leaveApplication.fromDate,
        toDate: leaveApplication.toDate,
        reason: leaveApplication.reason,
        approvalStatus: leaveApplication.approvalStatus,
        approvalAt: leaveApplication.approvalAt,
        approvalBy: leaveApplication.approvalBy,
        approvalReason: leaveApplication.approvalReason,
        createdAt: leaveApplication.createdAt,
        updatedAt: leaveApplication.updatedAt,
        createdBy: leaveApplication.createdBy,
        entrySourceType: leaveApplication.entrySourceType,
        approvalByUser: leaveApplication.approvalBy
          ? {
              id: leaveApplication.approvalBy,
              firstName: leaveApplication.approvalByFirstName,
              lastName: leaveApplication.approvalByLastName,
              email: leaveApplication.approvalByEmail,
              employeeId: leaveApplication.approvalByEmployeeId,
            }
          : null,
        user: leaveApplication.userId
          ? {
              id: leaveApplication.userId,
              firstName: leaveApplication.firstName,
              lastName: leaveApplication.lastName,
              email: leaveApplication.email,
              employeeId: leaveApplication.employeeId,
            }
          : null,
        createdByUser: leaveApplication.createdBy
          ? {
              id: leaveApplication.createdBy,
              firstName: leaveApplication.createdByFirstName,
              lastName: leaveApplication.createdByLastName,
              email: leaveApplication.createdByEmail,
              employeeId: leaveApplication.createdByEmployeeId,
            }
          : null,
      };
    });
  }

  private transformLeaveBalanceRecords(leaveBalances: any[]) {
    return leaveBalances.map((balance) => {
      const totalCredited = parseFloat(balance.totalAllocated);
      const totalConsumed = parseFloat(balance.consumed);
      const totalBalance = totalCredited - totalConsumed;

      return {
        totalCredited,
        totalConsumed,
        totalBalance,
      };
    });
  }

  private calculateStatsFromResults(statsResults: any[], leaveBalances: any[]) {
    // Initialize approval stats
    const approvalStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    // Calculate approval stats from query results
    statsResults.forEach((result) => {
      const count = parseInt(result.count);
      approvalStats.total += count;

      switch (result.approvalStatus) {
        case ApprovalStatus.PENDING:
          approvalStats.pending = count;
          break;
        case ApprovalStatus.APPROVED:
          approvalStats.approved = count;
          break;
        case ApprovalStatus.REJECTED:
          approvalStats.rejected = count;
          break;
        case ApprovalStatus.CANCELLED:
          approvalStats.cancelled = count;
          break;
      }
    });

    // Calculate leave balance stats considering all components
    const totalCredited = leaveBalances.reduce((sum, balance) => {
      return sum + parseFloat(balance.totalCredited);
    }, 0);
    const totalConsumed = leaveBalances.reduce(
      (sum, balance) => sum + parseFloat(balance.totalConsumed),
      0,
    );
    const totalBalance = totalCredited - totalConsumed;

    const leaveBalanceStats = {
      totalCredited,
      totalConsumed,
      totalBalance,
    };

    return {
      approval: approvalStats,
      leaveBalance: leaveBalanceStats,
    };
  }

  async handleBulkLeaveApplicationApproval({ approvals, approvalBy }: LeaveBulkApprovalDto) {
    try {
      const result = [];
      const errors = [];

      for (const approval of approvals) {
        try {
          const leaveApplication = await this.handleSingleLeaveApplicationApproval(
            approval.leaveApplicationId,
            approval,
            approvalBy,
          );
          result.push(leaveApplication);
        } catch (error) {
          errors.push({
            leaveApplicationId: approval.leaveApplicationId,
            error: error.message,
          });
        }
      }
      return {
        message: LEAVE_APPLICATION_SUCCESS_MESSAGES.LEAVE_APPLICATION_APPROVAL_PROCESSED.replace(
          '{length}',
          approvals.length.toString(),
        )
          .replace('{success}', result.length.toString())
          .replace('{error}', errors.length.toString()),
        result,
        errors,
      };
    } catch (error) {
      throw error;
    }
  }

  async handleSingleLeaveApplicationApproval(
    leaveApplicationId: string,
    approvalDto: LeaveApprovalDto,
    approvalBy: string,
  ) {
    try {
      const { approvalStatus, approvalComment, attendanceStatus = null } = approvalDto;

      return await this.dataSource.transaction(async (entityManager) => {
        const leaveApplication = await this.leaveApplicationsRepository.findOne(
          {
            where: { id: leaveApplicationId },
            relations: ['user'],
          },
          entityManager,
        );

        if (!leaveApplication) {
          throw new NotFoundException(LEAVE_APPLICATION_ERRORS.NOT_FOUND);
        }

        await this.validateAndUpdateLeaveApplicationApproval(
          leaveApplication,
          approvalStatus as ApprovalStatus,
          attendanceStatus,
          approvalBy,
          approvalComment,
        );

        return {
          message: LEAVE_APPLICATION_SUCCESS_MESSAGES.LEAVE_APPLICATION_APPROVAL_SUCCESS.replace(
            '{status}',
            approvalStatus,
          ),
          leaveApplicationId,
          approvalStatus,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  private async validateAndUpdateLeaveApplicationApproval(
    {
      approvalStatus: currentApprovalStatus,
      fromDate,
      id: leaveApplicationId,
      userId,
      leaveCategory,
    }: LeaveApplicationsEntity,
    approvalStatus: ApprovalStatus,
    attendanceStatus: string | null,
    approvalBy: string,
    approvalComment: string,
  ) {
    try {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      fromDate = new Date(fromDate);
      fromDate.setHours(0, 0, 0, 0);

      if (fromDate <= currentDate && !attendanceStatus) {
        throw new BadRequestException(
          LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_ATTENDANCE_STATUS_REQUIRED,
        );
      }
      if (attendanceStatus && fromDate > currentDate) {
        throw new BadRequestException(
          LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_ATTENDANCE_STATUS_NOT_ALLOWED,
        );
      }
      switch (currentApprovalStatus) {
        case ApprovalStatus.PENDING:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              // attendance status will be changed to leave only if approval is for current date or earlier
              await this.dataSource.transaction(async (entityManager) => {
                if (attendanceStatus) {
                  const attendance = await this.attendanceService.findOneOrFail({
                    where: { userId: userId, attendanceDate: fromDate, isActive: true },
                  });
                  await this.attendanceService.update(
                    { id: attendance.id },
                    {
                      isActive: false,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.attendanceService.create(
                    {
                      ...attendance,
                      status: attendanceStatus,
                      approvalStatus: ApprovalStatus.APPROVED,
                      approvalAt: new Date(),
                      approvalBy,
                      approvalComment: `${DEFAULT_APPROVAL_COMMENT.LEAVE_APPLICATION} - ${approvalComment}`,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                } else {
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                }
              });
              break;
            case ApprovalStatus.REJECTED:
              await this.dataSource.transaction(async (entityManager) => {
                if (attendanceStatus) {
                  const attendance = await this.attendanceService.findOneOrFail({
                    where: { userId: userId, attendanceDate: fromDate, isActive: true },
                  });
                  await this.attendanceService.update(
                    { id: attendance.id },
                    {
                      isActive: false,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.attendanceService.create(
                    {
                      ...attendance,
                      status: attendanceStatus,
                      approvalStatus: ApprovalStatus.APPROVED,
                      approvalAt: new Date(),
                      approvalBy,
                      approvalComment: `${DEFAULT_APPROVAL_COMMENT.LEAVE_APPLICATION} - ${approvalComment}`,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveBalanceService.update(
                    {
                      userId,
                      leaveCategory,
                      financialYear: this.utilityService.getFinancialYear(fromDate),
                    },
                    { consumed: () => '(consumed::int + 1)::varchar' } as any,
                    entityManager,
                  );
                } else {
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveBalanceService.update(
                    {
                      userId,
                      leaveCategory,
                      financialYear: this.utilityService.getFinancialYear(fromDate),
                    },
                    { consumed: () => '(consumed::int + 1)::varchar' } as any,
                    entityManager,
                  );
                }
              });
              break;
            case ApprovalStatus.CANCELLED:
              if (fromDate <= currentDate) {
                throw new BadRequestException(
                  LEAVE_APPLICATION_ERRORS.LEAVE_CANCELLATION_NOT_ALLOWED,
                );
              }
              await this.dataSource.transaction(async (entityManager) => {
                await this.leaveApplicationsRepository.update(
                  { id: leaveApplicationId },
                  {
                    approvalStatus,
                    approvalBy,
                    approvalAt: new Date(),
                    approvalReason: approvalComment,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                await this.leaveBalanceService.update(
                  {
                    userId,
                    leaveCategory,
                    financialYear: this.utilityService.getFinancialYear(fromDate),
                  },
                  { consumed: () => '(consumed::int + 1)::varchar' } as any,
                  entityManager,
                );
              });
              break;
          }
          break;
        case ApprovalStatus.APPROVED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.REJECTED:
              await this.dataSource.transaction(async (entityManager) => {
                if (attendanceStatus) {
                  const attendance = await this.attendanceService.findOneOrFail({
                    where: { userId: userId, attendanceDate: fromDate, isActive: true },
                  });
                  await this.attendanceService.update(
                    { id: attendance.id },
                    {
                      isActive: false,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.attendanceService.create(
                    {
                      ...attendance,
                      status: attendanceStatus,
                      approvalStatus: ApprovalStatus.APPROVED,
                      approvalAt: new Date(),
                      approvalBy,
                      approvalComment: `${DEFAULT_APPROVAL_COMMENT.LEAVE_APPLICATION} - ${approvalComment}`,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveBalanceService.update(
                    {
                      userId,
                      leaveCategory,
                      financialYear: this.utilityService.getFinancialYear(fromDate),
                    },
                    { consumed: () => '(consumed::int + 1)::varchar' } as any,
                    entityManager,
                  );
                } else {
                  await this.leaveApplicationsRepository.update(
                    { id: leaveApplicationId },
                    {
                      approvalStatus,
                      approvalBy,
                      approvalAt: new Date(),
                      approvalReason: approvalComment,
                      updatedBy: approvalBy,
                    },
                    entityManager,
                  );
                  await this.leaveBalanceService.update(
                    {
                      userId,
                      leaveCategory,
                      financialYear: this.utilityService.getFinancialYear(fromDate),
                    },
                    { consumed: () => '(consumed::int + 1)::varchar' } as any,
                    entityManager,
                  );
                }
              });
              break;
            case ApprovalStatus.CANCELLED:
              if (fromDate <= currentDate) {
                throw new BadRequestException(
                  LEAVE_APPLICATION_ERRORS.LEAVE_CANCELLATION_NOT_ALLOWED,
                );
              }
              await this.dataSource.transaction(async (entityManager) => {
                await this.leaveApplicationsRepository.update(
                  { id: leaveApplicationId },
                  {
                    approvalStatus,
                    approvalBy,
                    approvalAt: new Date(),
                    approvalReason: approvalComment,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                await this.leaveBalanceService.update(
                  {
                    userId,
                    leaveCategory,
                    financialYear: this.utilityService.getFinancialYear(fromDate),
                  },
                  { consumed: () => '(consumed::int + 1)::varchar' } as any,
                  entityManager,
                );
              });
              break;
          }
          break;
        case ApprovalStatus.REJECTED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_REJECTED_CANNOT_BE_APPROVED,
              );
            case ApprovalStatus.REJECTED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
          }
        case ApprovalStatus.CANCELLED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.REJECTED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                LEAVE_APPLICATION_ERRORS.LEAVE_APPLICATION_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
          }
      }
    } catch (error) {
      throw error;
    }
  }
}

// TODO: Holiday validation is pending and need to be done in force leave and approvals logic.
