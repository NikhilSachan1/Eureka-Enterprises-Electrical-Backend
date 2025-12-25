import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { PayrollRepository } from './payroll.repository';
import { SalaryStructureService } from '../salary-structures/salary-structure.service';
import { BonusService } from '../bonuses/bonus.service';
import { BonusRepository } from '../bonuses/bonus.repository';
import { GeneratePayrollDto, GenerateBulkPayrollDto, GetPayrollDto, UpdatePayrollDto } from './dto';
import { PayrollEntity } from './entities/payroll.entity';
import { BonusStatus } from '../bonuses/constants/bonus.constants';
import { PayrollStatus, PAYROLL_ERRORS, PAYROLL_RESPONSES } from './constants/payroll.constants';
import { UserStatus } from '../users/constants/user.constants';
import {
  buildPayrollSummaryQuery,
  buildActiveUsersWithSalaryQuery,
} from './queries/payroll.queries';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { WorkingDaysConfig } from './payroll.types';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly salaryStructureService: SalaryStructureService,
    private readonly bonusService: BonusService,
    private readonly bonusRepository: BonusRepository,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async generatePayroll(
    generateDto: GeneratePayrollDto,
    generatedBy: string,
  ): Promise<PayrollEntity> {
    const { userId, month, year } = generateDto;

    // Validate month/year is not in future
    this.validateNotFuture(month, year);

    // Check if payroll already exists
    const existing = await this.getPayrollByUserAndMonth(userId, month, year);
    if (existing) {
      throw new BadRequestException(PAYROLL_ERRORS.ALREADY_EXISTS);
    }

    // Get salary structure effective for this month
    const effectiveDate = new Date(year, month - 1, 15); // Mid-month
    const salaryStructure = await this.salaryStructureService.findEffectiveOnDate(
      userId,
      effectiveDate,
    );
    if (!salaryStructure) {
      throw new NotFoundException(PAYROLL_ERRORS.NO_SALARY_STRUCTURE);
    }

    // Get pending bonuses for this month
    const bonuses = await this.bonusService.getPendingBonusesForPayroll(userId, month, year);
    const totalBonus = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);
    const bonusDetails = bonuses.map((b) => ({
      bonusId: b.id,
      type: b.bonusType,
      amount: Number(b.amount),
    }));

    // Calculate attendance (default to full month for now)
    // TODO: Integrate with attendance module
    const daysInMonth = new Date(year, month, 0).getDate();
    const workingDays = await this.calculateWorkingDays(year, month);
    const presentDays = workingDays; // Default to full attendance
    const absentDays = 0;
    const paidLeaveDays = 0;
    const unpaidLeaveDays = 0;
    const holidays = daysInMonth - workingDays;
    const weekoffs = 0;

    // Calculate prorated salary (based on working days)
    const prorateMultiplier = presentDays / workingDays;
    const basicProrated = Math.round(Number(salaryStructure.basic) * prorateMultiplier);
    const hraProrated = Math.round(Number(salaryStructure.hra) * prorateMultiplier);
    const foodAllowanceProrated = Math.round(
      Number(salaryStructure.foodAllowance) * prorateMultiplier,
    );
    const conveyanceAllowanceProrated = Math.round(
      Number(salaryStructure.conveyanceAllowance) * prorateMultiplier,
    );
    const medicalAllowanceProrated = Math.round(
      Number(salaryStructure.medicalAllowance) * prorateMultiplier,
    );
    const specialAllowanceProrated = Math.round(
      Number(salaryStructure.specialAllowance) * prorateMultiplier,
    );

    // Calculate LOP deduction
    const dailySalary = Number(salaryStructure.grossSalary) / workingDays;
    const lopDeduction = Math.round(dailySalary * unpaidLeaveDays);

    // Calculate totals
    const grossEarnings =
      basicProrated +
      hraProrated +
      foodAllowanceProrated +
      conveyanceAllowanceProrated +
      medicalAllowanceProrated +
      specialAllowanceProrated +
      totalBonus;

    const totalDeductions =
      Number(salaryStructure.employeePf) +
      Number(salaryStructure.tds) +
      Number(salaryStructure.esic) +
      Number(salaryStructure.professionalTax) +
      lopDeduction;

    const netPayable = grossEarnings - totalDeductions;

    return this.dataSource.transaction(async (manager) => {
      // Create payroll record
      const payroll = await this.payrollRepository.create(
        {
          userId,
          salaryStructureId: salaryStructure.id,
          month,
          year,
          totalDays: daysInMonth,
          workingDays,
          presentDays,
          absentDays,
          paidLeaveDays,
          unpaidLeaveDays,
          holidays,
          weekoffs,
          basicProrated,
          hraProrated,
          foodAllowanceProrated,
          conveyanceAllowanceProrated,
          medicalAllowanceProrated,
          specialAllowanceProrated,
          employeePf: salaryStructure.employeePf,
          employerPf: salaryStructure.employerPf,
          tds: salaryStructure.tds,
          esic: salaryStructure.esic,
          professionalTax: salaryStructure.professionalTax,
          lopDeduction,
          totalBonus,
          bonusDetails,
          grossEarnings,
          totalDeductions,
          netPayable,
          status: PayrollStatus.GENERATED,
          generatedAt: new Date(),
          createdBy: generatedBy,
        },
        manager,
      );

      // Mark bonuses as paid
      for (const bonus of bonuses) {
        await this.bonusRepository.update(
          { id: bonus.id },
          { status: BonusStatus.PAID, updatedBy: generatedBy },
          manager,
        );
      }

      return payroll;
    });
  }

  async generateBulkPayroll(
    generateDto: GenerateBulkPayrollDto,
    generatedBy: string,
  ): Promise<{ message: string; success: number; failed: number; errors: any[] }> {
    const { month, year } = generateDto;

    // Validate month/year is not in future
    this.validateNotFuture(month, year);

    // Get all active users with salary structures
    const { query, params } = buildActiveUsersWithSalaryQuery(UserStatus.ACTIVE);
    const usersWithSalary = await this.payrollRepository.executeRawQuery(query, params);

    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const { userId } of usersWithSalary) {
      try {
        await this.generatePayroll({ userId, month, year }, generatedBy);
        success++;
      } catch (error) {
        failed++;
        errors.push({ userId, error: error.message });
        Logger.error(`Failed to generate payroll for user ${userId}:`, error);
      }
    }

    return {
      message: PAYROLL_RESPONSES.BULK_GENERATED.replace('{success}', success.toString()).replace(
        '{failed}',
        failed.toString(),
      ),
      success,
      failed,
      errors,
    };
  }

  async findAll(options: GetPayrollDto) {
    return await this.payrollRepository.findAll(options);
  }

  async findOne(id: string): Promise<PayrollEntity> {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
      relations: ['user', 'salaryStructure', 'approver'],
    });
    if (!payroll) {
      throw new NotFoundException(PAYROLL_ERRORS.NOT_FOUND);
    }
    return payroll;
  }

  private async getPayrollByUserAndMonth(
    userId: string,
    month: number,
    year: number,
  ): Promise<PayrollEntity | null> {
    return await this.payrollRepository.findOne({
      where: { userId, month, year },
    });
  }

  async update(
    id: string,
    updateDto: UpdatePayrollDto,
    updatedBy: string,
  ): Promise<{ message: string }> {
    const payroll = await this.findOne(id);

    // If status is being updated, validate the transition
    if (updateDto.status) {
      this.validateStatusTransition(payroll.status, updateDto.status);
    }

    // Build update data
    const updateData: Partial<PayrollEntity> = {
      ...updateDto,
      updatedBy,
    };

    // Add timestamps based on status change
    if (updateDto.status === PayrollStatus.APPROVED) {
      updateData.approvedBy = updatedBy;
      updateData.approvedAt = new Date();
    } else if (updateDto.status === PayrollStatus.PAID) {
      updateData.paidAt = new Date();
    }

    await this.payrollRepository.update({ id }, updateData);

    // Return appropriate message based on status change
    if (updateDto.status === PayrollStatus.APPROVED) {
      return { message: PAYROLL_RESPONSES.APPROVED };
    } else if (updateDto.status === PayrollStatus.PAID) {
      return { message: PAYROLL_RESPONSES.PAID };
    } else if (updateDto.status === PayrollStatus.CANCELLED) {
      return { message: PAYROLL_RESPONSES.CANCELLED };
    }

    return { message: PAYROLL_RESPONSES.UPDATED };
  }

  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    // Define valid transitions
    const validTransitions: Record<PayrollStatus, PayrollStatus[]> = {
      [PayrollStatus.DRAFT]: [PayrollStatus.GENERATED, PayrollStatus.CANCELLED],
      [PayrollStatus.GENERATED]: [PayrollStatus.APPROVED, PayrollStatus.CANCELLED],
      [PayrollStatus.APPROVED]: [PayrollStatus.PAID, PayrollStatus.CANCELLED],
      [PayrollStatus.PAID]: [], // Cannot transition from PAID
      [PayrollStatus.CANCELLED]: [], // Cannot transition from CANCELLED
    };

    if (currentStatus === newStatus) {
      return; // No change
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      if (currentStatus === PayrollStatus.PAID) {
        throw new BadRequestException(PAYROLL_ERRORS.ALREADY_PAID);
      }
      if (currentStatus === PayrollStatus.CANCELLED) {
        throw new BadRequestException(PAYROLL_ERRORS.ALREADY_CANCELLED);
      }
      if (currentStatus === PayrollStatus.APPROVED && newStatus === PayrollStatus.APPROVED) {
        throw new BadRequestException(PAYROLL_ERRORS.ALREADY_APPROVED);
      }
      if (newStatus === PayrollStatus.PAID && currentStatus !== PayrollStatus.APPROVED) {
        throw new BadRequestException(PAYROLL_ERRORS.MUST_BE_APPROVED_BEFORE_PAID);
      }
      throw new BadRequestException(PAYROLL_ERRORS.INVALID_STATUS_TRANSITION);
    }
  }

  async getSummary(month: number, year: number) {
    const { query, params } = buildPayrollSummaryQuery(month, year);
    const results = await this.payrollRepository.executeRawQuery(query, params);
    return results?.[0] || null;
  }

  // ==================== Private Helpers ====================

  private validateNotFuture(month: number, year: number): void {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      throw new BadRequestException(PAYROLL_ERRORS.FUTURE_PAYROLL);
    }
  }

  private async getWorkingDaysConfig(): Promise<WorkingDaysConfig> {
    const configuration = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.PAYROLL_WORKING_DAYS_CALCULATION,
        module: CONFIGURATION_MODULES.PAYROLL,
      },
    });

    if (!configuration) {
      throw new BadRequestException(PAYROLL_ERRORS.WORKING_DAYS_CONFIG_NOT_FOUND);
    }

    const configSetting = await this.configSettingService.findOne({
      where: { configId: configuration.id, isActive: true },
    });

    if (!configSetting?.value) {
      throw new BadRequestException(PAYROLL_ERRORS.WORKING_DAYS_CONFIG_SETTING_NOT_FOUND);
    }

    return configSetting.value as WorkingDaysConfig;
  }

  private async calculateWorkingDays(year: number, month: number): Promise<number> {
    const config = await this.getWorkingDaysConfig();
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      // Check if it's a weekend
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;

      if (config.excludeSundays && isSunday) continue;
      if (config.excludeSaturdays && isSaturday) continue;

      // TODO: If useHolidayCalendar is true, check holiday_calendar config
      workingDays++;
    }

    return workingDays || config.defaultWorkingDays;
  }
}
