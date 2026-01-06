import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { PayrollRepository } from './payroll.repository';
import { SalaryStructureService } from '../salary-structures/salary-structure.service';
import { BonusService } from '../bonuses/bonus.service';
import { BonusRepository } from '../bonuses/bonus.repository';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { PayslipService } from './payslip/payslip.service';
import { GeneratePayrollDto, GenerateBulkPayrollDto, GetPayrollDto, UpdatePayrollDto } from './dto';
import { PayrollEntity } from './entities/payroll.entity';
import { BonusStatus } from '../bonuses/constants/bonus.constants';
import {
  PayrollStatus,
  PAYROLL_ERRORS,
  PAYROLL_RESPONSES,
  HOLIDAY_WORK_CREDIT,
  HolidayWorkCompensationType,
} from './constants/payroll.constants';
import { UserStatus } from '../users/constants/user.constants';
import {
  buildPayrollSummaryQuery,
  buildActiveUsersWithSalaryQuery,
  buildAttendanceSummaryForPayrollQuery,
  buildLeaveSummaryForPayrollQuery,
  buildPresentDatesForPayrollQuery,
  buildUserExitCheckQuery,
} from './queries/payroll.queries';
import { UtilityService } from 'src/utils/utility/utility.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import {
  WorkingDaysConfig,
  AttendanceSummary,
  LeaveSummaryItem,
  HolidayWorkCompensationConfig,
  FnfSalaryCalculationInput,
  FnfSalaryBreakdown,
} from './payroll.types';

@Injectable()
export class PayrollService {
  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly salaryStructureService: SalaryStructureService,
    private readonly bonusService: BonusService,
    private readonly bonusRepository: BonusRepository,
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly payslipService: PayslipService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async generatePayroll(
    generateDto: GeneratePayrollDto,
    generatedBy: string,
    initialStatus: PayrollStatus = PayrollStatus.GENERATED,
  ): Promise<PayrollEntity> {
    const { userId, month, year } = generateDto;

    // Validate month/year is not in future
    this.validateNotFuture(month, year);

    // Check if user is exiting this month (should use FNF instead)
    await this.validateUserNotExitingThisMonth(userId, month, year);

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

    // Calculate attendance from actual data
    const daysInMonth = new Date(year, month, 0).getDate();
    const workingDays = await this.calculateWorkingDays(year, month);

    // Get attendance summary from actual attendance records
    const attendanceSummary = await this.getAttendanceSummaryForPayroll(userId, month, year);
    const leaveSummary = await this.getLeaveSummaryForPayroll(userId, month, year);

    // Calculate present days (including half days as 0.5)
    const fullPresentDays = attendanceSummary.presentDays;
    const halfDayCount = attendanceSummary.halfDays;
    const effectivePresentDays = fullPresentDays + halfDayCount * 0.5;

    // Paid leave days from attendance (status = 'leave')
    const paidLeaveDays = attendanceSummary.paidLeaveDays;

    // Unpaid leave days (LOP) from attendance (status = 'leaveWithoutPay')
    const unpaidLeaveDays = attendanceSummary.unpaidLeaveDays;

    // Absent days from attendance
    const absentDays = attendanceSummary.absentDays;

    // Holidays from attendance records
    const holidays = attendanceSummary.holidays;

    // Calculate holidays worked (employee worked on a holiday - gets extra pay)
    const holidaysWorked = await this.calculateHolidaysWorked(userId, month, year);

    // Calculate weekoffs (days in month - working days - holidays recorded in attendance)
    const weekoffs = daysInMonth - workingDays - holidays;

    // Total payable days = present + paid leave + holidays (weekoffs already excluded from working days)
    // Deductible days = absent + unpaid leave + half of half-days
    const totalPayableDays = effectivePresentDays + paidLeaveDays;
    const lopDays = unpaidLeaveDays + absentDays + halfDayCount * 0.5;

    // If no attendance records yet, fall back to full working days
    const presentDays = totalPayableDays > 0 ? totalPayableDays : workingDays;

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

    // Calculate LOP deduction (for absent days + unpaid leave days + half of half-days)
    const dailySalary = Number(salaryStructure.grossSalary) / workingDays;
    const lopDeduction = Math.round(dailySalary * lopDays);

    const holidayWorkConfig = await this.getHolidayWorkCompensationConfig();
    const compensationType = holidayWorkConfig?.type || HolidayWorkCompensationType.MONEY;
    const leavePerHoliday = holidayWorkConfig?.leavePerHoliday || 1;

    let holidayBonus = 0;
    let holidayLeavesCredited = 0;

    if (compensationType === HolidayWorkCompensationType.MONEY) {
      holidayBonus = Math.round(dailySalary * holidaysWorked);
    } else if (compensationType === HolidayWorkCompensationType.LEAVE && holidaysWorked > 0) {
      holidayLeavesCredited = holidaysWorked * leavePerHoliday;
    }

    // Calculate totals
    const grossEarnings =
      basicProrated +
      hraProrated +
      foodAllowanceProrated +
      conveyanceAllowanceProrated +
      medicalAllowanceProrated +
      specialAllowanceProrated +
      totalBonus +
      holidayBonus;

    const totalDeductions =
      Number(salaryStructure.employeePf) +
      Number(salaryStructure.tds) +
      Number(salaryStructure.esic) +
      Number(salaryStructure.professionalTax) +
      lopDeduction;

    const netPayable = grossEarnings - totalDeductions;

    const holidayDatesWorked =
      holidayLeavesCredited > 0 ? await this.getHolidayDatesWorkedByUser(userId, month, year) : [];

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
          holidaysWorked,
          weekoffs,
          halfDays: halfDayCount,
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
          holidayBonus,
          holidayLeavesCredited,
          bonusDetails,
          leaveDetails: leaveSummary,
          grossEarnings,
          totalDeductions,
          netPayable,
          status: initialStatus,
          generatedAt: new Date(),
          createdBy: generatedBy,
        },
        manager,
      );

      // Credit earned leaves for holiday work (if configured)
      if (holidayLeavesCredited > 0) {
        await this.creditHolidayWorkLeaves(
          userId,
          holidayLeavesCredited,
          month,
          year,
          holidayDatesWorked,
          holidayWorkConfig?.leaveCategory || 'earned',
          generatedBy,
          manager,
        );
      }

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
    initialStatus: PayrollStatus = PayrollStatus.GENERATED,
  ): Promise<{ message: string; success: number; failed: number; errors: any[] }> {
    const { month, year } = generateDto;

    // Validate month/year is not in future
    this.validateNotFuture(month, year);

    // Get all active users with salary structures
    // Excludes users whose lastWorkingDate falls within the payroll month (handled by FNF)
    const { query, params } = buildActiveUsersWithSalaryQuery(UserStatus.ACTIVE, month, year);
    const usersWithSalary = await this.payrollRepository.executeRawQuery(query, params);

    let success = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const { userId } of usersWithSalary) {
      try {
        await this.generatePayroll({ userId, month, year }, generatedBy, initialStatus);
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

  async findByUserMonthYear(userId: string, month: number, year: number): Promise<PayrollEntity> {
    const payroll = await this.payrollRepository.findOne({
      where: { userId, month, year },
      relations: ['user', 'salaryStructure', 'approver'],
    });
    if (!payroll) {
      throw new NotFoundException(PAYROLL_ERRORS.NOT_FOUND);
    }
    return payroll;
  }

  async generatePayslipPdf(payrollId: string): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const payroll = await this.findOne(payrollId);
    const pdfBuffer = await this.payslipService.generatePayslipPDF(payrollId);
    const monthName = this.utilityService.getMonthName(payroll.month, true);
    const filename = `Payslip_${monthName}_${payroll.year}_${
      payroll.user?.employeeId || payroll.userId
    }.pdf`;
    return { pdfBuffer, filename };
  }

  async generatePayslipPdfByUserMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const payroll = await this.findByUserMonthYear(userId, month, year);
    return this.generatePayslipPdf(payroll.id);
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

    if (updateDto.status === PayrollStatus.PAID) {
      // Send payslip asynchronously (don't block the response)
      this.payslipService
        .generateAndSendPayslip({ payrollId: id, sendEmail: true })
        .catch((error) => {
          Logger.error(`Failed to generate/send payslip for payroll ${id}:`, error);
        });
    }

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

  // ==================== FNF Salary Calculation ====================

  /**
   * Calculate pro-rated salary for FNF (Full & Final) settlement.
   * Uses the same logic as regular payroll but for partial month (1st to last working date).
   * Includes holiday work compensation if employee worked on holidays.
   *
   * TODO: Add pending bonuses integration if required in future
   */
  async calculateFnfSalary(input: FnfSalaryCalculationInput): Promise<FnfSalaryBreakdown> {
    const { userId, lastWorkingDate } = input;

    const exitMonth = lastWorkingDate.getMonth() + 1;
    const exitYear = lastWorkingDate.getFullYear();
    const lastWorkingDay = lastWorkingDate.getDate();

    // Get salary structure effective for this month
    const effectiveDate = new Date(exitYear, exitMonth - 1, 15);
    const salaryStructure = await this.salaryStructureService.findEffectiveOnDate(
      userId,
      effectiveDate,
    );
    if (!salaryStructure) {
      throw new NotFoundException(PAYROLL_ERRORS.NO_SALARY_STRUCTURE);
    }

    // Calculate working days
    const totalDaysInMonth = new Date(exitYear, exitMonth, 0).getDate();
    const totalWorkingDaysInMonth = await this.calculateWorkingDays(exitYear, exitMonth);

    // Calculate working days until last working date
    const daysWorked = await this.calculateWorkingDaysUntilDate(
      exitYear,
      exitMonth,
      lastWorkingDay,
    );

    // Get attendance summary for the exit month (from 1st to last working date)
    const attendanceSummary = await this.getAttendanceSummaryForFnf(
      userId,
      exitMonth,
      exitYear,
      lastWorkingDay,
    );

    // Calculate effective present days
    const fullPresentDays = attendanceSummary.presentDays;
    const halfDayCount = attendanceSummary.halfDays;
    const effectivePresentDays = fullPresentDays + halfDayCount * 0.5;

    const paidLeaveDays = attendanceSummary.paidLeaveDays;
    const unpaidLeaveDays = attendanceSummary.unpaidLeaveDays;
    const absentDays = attendanceSummary.absentDays;

    // Total payable days = present + paid leave
    const totalPayableDays = effectivePresentDays + paidLeaveDays;
    const lopDays = unpaidLeaveDays + absentDays + halfDayCount * 0.5;

    // If no attendance records, use working days until last working date
    const presentDays = totalPayableDays > 0 ? totalPayableDays : daysWorked;

    // Calculate pro-rate multiplier based on working days
    const prorateMultiplier = presentDays / totalWorkingDaysInMonth;

    // Pro-rate each salary component
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

    // Daily salary for calculations
    const dailySalary = Number(salaryStructure.grossSalary) / totalWorkingDaysInMonth;

    // Holiday work compensation (same logic as regular payroll)
    const holidaysWorked = await this.calculateHolidaysWorkedForFnf(
      userId,
      exitMonth,
      exitYear,
      lastWorkingDay,
    );

    let holidayBonus = 0;
    const holidayWorkConfig = await this.getHolidayWorkCompensationConfig();
    const compensationType = holidayWorkConfig?.type || HolidayWorkCompensationType.MONEY;

    // For FNF, always pay as money (no leave credit since employee is leaving)
    if (holidaysWorked > 0 && compensationType === HolidayWorkCompensationType.MONEY) {
      holidayBonus = Math.round(dailySalary * holidaysWorked);
    } else if (holidaysWorked > 0) {
      // Even if config says LEAVE, pay as money for FNF (employee can't use leaves after exit)
      holidayBonus = Math.round(dailySalary * holidaysWorked);
    }

    // Gross earnings (pro-rated + holiday bonus)
    const grossEarnings =
      basicProrated +
      hraProrated +
      foodAllowanceProrated +
      conveyanceAllowanceProrated +
      medicalAllowanceProrated +
      specialAllowanceProrated +
      holidayBonus;

    // Pro-rate deductions
    const employeePfProrated = Math.round(Number(salaryStructure.employeePf) * prorateMultiplier);
    const tdsProrated = Math.round(Number(salaryStructure.tds) * prorateMultiplier);
    const esicProrated = Math.round(Number(salaryStructure.esic) * prorateMultiplier);
    // Professional tax is typically flat per month, prorate only if partial month
    const professionalTaxProrated =
      presentDays >= totalWorkingDaysInMonth
        ? Number(salaryStructure.professionalTax)
        : Math.round(Number(salaryStructure.professionalTax) * prorateMultiplier);

    // LOP deduction
    const lopDeduction = Math.round(dailySalary * lopDays);

    // Total deductions
    const totalDeductions =
      employeePfProrated + tdsProrated + esicProrated + professionalTaxProrated + lopDeduction;

    // Net salary
    const netSalary = grossEarnings - totalDeductions;

    return {
      totalDaysInMonth,
      totalWorkingDaysInMonth,
      daysWorked,
      prorateMultiplier: Math.round(prorateMultiplier * 10000) / 10000,
      basicProrated,
      hraProrated,
      foodAllowanceProrated,
      conveyanceAllowanceProrated,
      medicalAllowanceProrated,
      specialAllowanceProrated,
      grossEarnings,
      holidaysWorked,
      holidayBonus,
      employeePfProrated,
      tdsProrated,
      esicProrated,
      professionalTaxProrated,
      lopDeduction,
      totalDeductions,
      presentDays,
      absentDays,
      halfDays: halfDayCount,
      paidLeaveDays,
      unpaidLeaveDays,
      holidays: attendanceSummary.holidays,
      netSalary,
      dailySalary: Math.round(dailySalary * 100) / 100,
    };
  }

  private async calculateWorkingDaysUntilDate(
    year: number,
    month: number,
    untilDay: number,
  ): Promise<number> {
    const config = await this.getWorkingDaysConfig();
    let workingDays = 0;

    for (let day = 1; day <= untilDay; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();

      if (config.excludeSundays && dayOfWeek === 0) continue;
      if (config.excludeSaturdays && dayOfWeek === 6) continue;

      workingDays++;
    }

    return workingDays;
  }

  private async getAttendanceSummaryForFnf(
    userId: string,
    month: number,
    year: number,
    lastWorkingDay: number,
  ): Promise<AttendanceSummary> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastWorkingDay
      .toString()
      .padStart(2, '0')}`;

    const { query, params } = buildAttendanceSummaryForPayrollQuery(userId, startDate, endDate);
    const results = await this.payrollRepository.executeRawQuery(query, params);

    const result = results?.[0];
    return {
      presentDays: parseInt(result?.presentDays || '0'),
      absentDays: parseInt(result?.absentDays || '0'),
      halfDays: parseInt(result?.halfDays || '0'),
      paidLeaveDays: parseInt(result?.paidLeaveDays || '0'),
      unpaidLeaveDays: parseInt(result?.unpaidLeaveDays || '0'),
      holidays: parseInt(result?.holidays || '0'),
    };
  }

  private async calculateHolidaysWorkedForFnf(
    userId: string,
    month: number,
    year: number,
    lastWorkingDay: number,
  ): Promise<number> {
    const holidayDates = await this.getHolidayDatesForMonth(month, year);
    const presentDates = await this.getPresentDatesForFnf(userId, month, year, lastWorkingDay);

    if (holidayDates.length === 0 || presentDates.length === 0) {
      return 0;
    }

    // Filter holidays that fall within the FNF period (1st to last working date)
    const lastWorkingDateStr = `${year}-${month.toString().padStart(2, '0')}-${lastWorkingDay
      .toString()
      .padStart(2, '0')}`;
    const validHolidays = holidayDates.filter((date) => date <= lastWorkingDateStr);

    const holidaySet = new Set(validHolidays);
    return presentDates.filter((date) => holidaySet.has(date)).length;
  }

  private async getPresentDatesForFnf(
    userId: string,
    month: number,
    year: number,
    lastWorkingDay: number,
  ): Promise<string[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastWorkingDay
      .toString()
      .padStart(2, '0')}`;

    const { query, params } = buildPresentDatesForPayrollQuery(userId, startDate, endDate);
    const results = await this.payrollRepository.executeRawQuery(query, params);

    return (results || []).map((row: { attendanceDate: string }) => row.attendanceDate);
  }

  // ==================== Private Helpers ====================

  /**
   * Get attendance summary for a user for a specific month
   */
  private async getAttendanceSummaryForPayroll(
    userId: string,
    month: number,
    year: number,
  ): Promise<AttendanceSummary> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    const { query, params } = buildAttendanceSummaryForPayrollQuery(userId, startDate, endDate);
    const results = await this.payrollRepository.executeRawQuery(query, params);

    const result = results?.[0];
    return {
      presentDays: parseInt(result?.presentDays || '0'),
      absentDays: parseInt(result?.absentDays || '0'),
      halfDays: parseInt(result?.halfDays || '0'),
      paidLeaveDays: parseInt(result?.paidLeaveDays || '0'),
      unpaidLeaveDays: parseInt(result?.unpaidLeaveDays || '0'),
      holidays: parseInt(result?.holidays || '0'),
    };
  }

  /**
   * Get leave summary for a user for a specific month
   */
  private async getLeaveSummaryForPayroll(
    userId: string,
    month: number,
    year: number,
  ): Promise<LeaveSummaryItem[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    const { query, params } = buildLeaveSummaryForPayrollQuery(userId, startDate, endDate);
    const results = await this.payrollRepository.executeRawQuery(query, params);

    return (results || []).map((item: any) => ({
      leaveCategory: item.leaveCategory,
      leaveType: item.leaveType,
      count: parseInt(item.count || '0'),
    }));
  }

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

  private async getHolidayDatesForMonth(month: number, year: number): Promise<string[]> {
    try {
      const financialYear = this.utilityService.getFinancialYear(new Date(year, month - 1, 1));

      const holidayCalendarConfig = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.LEAVE,
          key: CONFIGURATION_KEYS.HOLIDAY_CALENDAR,
        },
      });

      if (!holidayCalendarConfig) {
        return [];
      }

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: holidayCalendarConfig.id,
          contextKey: financialYear,
          isActive: true,
        },
      });

      if (!configSetting?.value?.holidays) {
        return [];
      }

      const holidays: Array<{ date: string }> = configSetting.value.holidays;

      const monthStr = month.toString().padStart(2, '0');
      const yearStr = year.toString();

      return holidays
        .filter((holiday) => {
          const [holidayYear, holidayMonth] = holiday.date.split('-');
          return holidayYear === yearStr && holidayMonth === monthStr;
        })
        .map((holiday) => holiday.date);
    } catch (error) {
      Logger.warn(`Error getting holiday calendar for ${month}/${year}`, error);
      return [];
    }
  }

  private async getPresentDatesForPayroll(
    userId: string,
    month: number,
    year: number,
  ): Promise<string[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay
      .toString()
      .padStart(2, '0')}`;

    const { query, params } = buildPresentDatesForPayrollQuery(userId, startDate, endDate);
    const results = await this.payrollRepository.executeRawQuery(query, params);

    return (results || []).map((row: { attendanceDate: string }) => row.attendanceDate);
  }

  private async calculateHolidaysWorked(
    userId: string,
    month: number,
    year: number,
  ): Promise<number> {
    const [holidayDates, presentDates] = await Promise.all([
      this.getHolidayDatesForMonth(month, year),
      this.getPresentDatesForPayroll(userId, month, year),
    ]);

    if (holidayDates.length === 0 || presentDates.length === 0) {
      return 0;
    }

    const holidaySet = new Set(holidayDates);
    return presentDates.filter((date) => holidaySet.has(date)).length;
  }

  private async getHolidayWorkCompensationConfig(): Promise<HolidayWorkCompensationConfig | null> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.HOLIDAY_WORK_COMPENSATION,
          module: CONFIGURATION_MODULES.PAYROLL,
        },
      });

      if (!configuration) {
        return null;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      return configSetting?.value as HolidayWorkCompensationConfig | null;
    } catch (error) {
      Logger.warn('Error fetching holiday work compensation config', error);
      return null;
    }
  }

  private async getHolidayDatesWorkedByUser(
    userId: string,
    month: number,
    year: number,
  ): Promise<string[]> {
    const [holidayDates, presentDates] = await Promise.all([
      this.getHolidayDatesForMonth(month, year),
      this.getPresentDatesForPayroll(userId, month, year),
    ]);

    if (holidayDates.length === 0 || presentDates.length === 0) {
      return [];
    }

    const holidaySet = new Set(holidayDates);
    return presentDates.filter((date) => holidaySet.has(date));
  }

  private async creditHolidayWorkLeaves(
    userId: string,
    leavesToCredit: number,
    month: number,
    year: number,
    holidayDatesWorked: string[],
    leaveCategory: string,
    createdBy: string,
    entityManager: EntityManager,
  ): Promise<void> {
    try {
      const financialYear = this.utilityService.getFinancialYear(new Date(year, month - 1, 1));

      const existingBalance = await this.leaveBalancesService.findOne({
        where: { userId, leaveCategory, financialYear },
      });

      if (!existingBalance) {
        Logger.warn(
          HOLIDAY_WORK_CREDIT.LOG_CONFIG_NOT_FOUND.replace('{financialYear}', financialYear),
        );
        return;
      }

      const formattedDates = holidayDatesWorked
        .map((date) => {
          const d = new Date(date);
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        })
        .join(', ');

      const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
        month: 'short',
      });

      const creditNote = HOLIDAY_WORK_CREDIT.NOTE_TEMPLATE.replace(
        '{leavesToCredit}',
        leavesToCredit.toString(),
      )
        .replace('{holidayDates}', formattedDates)
        .replace('{monthYear}', `${monthName}-${year}`);

      const newTotalAllocated = parseFloat(existingBalance.totalAllocated) + leavesToCredit;

      const updatedNotes = existingBalance.notes
        ? `${existingBalance.notes} | ${creditNote}`
        : creditNote;

      await this.leaveBalancesService.update(
        { id: existingBalance.id },
        {
          totalAllocated: newTotalAllocated.toString(),
          notes: updatedNotes,
          updatedBy: createdBy,
        },
        entityManager,
      );

      Logger.log(
        HOLIDAY_WORK_CREDIT.LOG_SUCCESS.replace(
          '{leavesToCredit}',
          leavesToCredit.toString(),
        ).replace('{userId}', userId),
      );
    } catch (error) {
      Logger.error(HOLIDAY_WORK_CREDIT.LOG_ERROR.replace('{userId}', userId), error);
      throw error;
    }
  }

  private async validateUserNotExitingThisMonth(
    userId: string,
    month: number,
    year: number,
  ): Promise<void> {
    const { query, params } = buildUserExitCheckQuery(userId);
    const result = await this.dataSource.query(query, params);

    if (result.length > 0 && result[0].lastWorkingDate) {
      const lastWorkingDate = new Date(result[0].lastWorkingDate);
      const lwdMonth = lastWorkingDate.getMonth() + 1;
      const lwdYear = lastWorkingDate.getFullYear();

      if (lwdMonth === month && lwdYear === year) {
        throw new BadRequestException(
          PAYROLL_ERRORS.USER_EXITING_USE_FNF.replace(
            '{lastWorkingDate}',
            lastWorkingDate.toLocaleDateString('en-IN'),
          ),
        );
      }
    }
  }
}
