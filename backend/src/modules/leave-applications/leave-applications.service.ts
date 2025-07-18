import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { LeaveApplicationsEntity } from './entities/leave-application.entity';
import {
  DataSource,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';
import { LeaveApplicationsRepository } from './leave-applications.repository';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import {
  LEAVE_APPLICATION_ERRORS,
  LEAVE_APPLICATION_FIELD_NAMES,
  ApprovalStatus,
  LeaveType,
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

@Injectable()
export class LeaveApplicationsService {
  constructor(
    private readonly leaveApplicationsRepository: LeaveApplicationsRepository,
    private readonly utilityService: UtilityService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly leaveBalanceService: LeaveBalancesService,
    @InjectDataSource() private readonly dataSource: DataSource,
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

  private async getLeaveCalendarSetting(contextKey: string) {
    const leaveCalendarSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.LEAVE, key: CONFIGURATION_KEYS.CALENDAR_SETTINGS },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveCalendarSetting.id, contextKey, isActive: true },
    });

    return configSetting;
  }

  private async validateLeaveType(leaveType: string, contextKey: string) {
    const leaveTypeSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.LEAVE, key: CONFIGURATION_KEYS.LEAVE_TYPES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveTypeSetting.id, contextKey, isActive: true },
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

  private async validateLeaveCategory(leaveCategory: string, contextKey: string) {
    const leaveCategorySetting = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.LEAVE,
        key: CONFIGURATION_KEYS.LEAVE_CATEGORIES,
      },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: leaveCategorySetting.id, contextKey, isActive: true },
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

    if (
      parseFloat(leaveBalance.totalAllocated) - parseFloat(leaveBalance.consumed) <
      numberOfDays
    ) {
      throw new BadRequestException(
        LEAVE_APPLICATION_ERRORS.LEAVE_BALANCE_EXHAUSTED.replace(
          '{leaveCategory}',
          leaveCategory,
        ).replace('{numberOfDays}', numberOfDays.toString()),
      );
    }

    return leaveBalance;
  }

  private calculateDaysBetween(fromDate: string, toDate: string): number {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);

    const timeDifference = endDate.getTime() - startDate.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));
    return daysDifference;
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
    contextKey: string,
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
      where: { configId: leaveCategoriesConfigSetting.id, contextKey, isActive: true },
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
  }: CreateLeaveApplicationDto & { userId: string }) {
    try {
      const {
        contextKey,
        value: { cycleType },
      } = await this.getLeaveCalendarSetting(leaveType);
      const { financialYear, numberOfDays } = await this.validateLeaveDates(
        fromDate,
        toDate,
        cycleType,
      );
      await this.validateLeaveType(leaveType, contextKey);
      await this.validateLeaveCategory(leaveCategory, contextKey);
      await this.validateLeaveApplication(
        leaveCategory,
        contextKey,
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
        // Create the leave application
        const leaveApplicationData = {
          userId,
          leaveType,
          leaveCategory,
          fromDate: new Date(fromDate),
          toDate: new Date(toDate),
          reason,
          approvalStatus: ApprovalStatus.PENDING,
        };

        await this.create(leaveApplicationData, entityManager);

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
}
