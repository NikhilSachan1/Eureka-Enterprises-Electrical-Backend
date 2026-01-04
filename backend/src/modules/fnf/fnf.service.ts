import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { FnfRepository } from './fnf.repository';
import { FnfEntity } from './entities/fnf.entity';
import { InitiateFnfDto, UpdateFnfDto, UpdateClearanceDto, FnfQueryDto } from './dto';
import {
  FnfStatus,
  ClearanceStatus,
  FNF_ERRORS,
  FNF_SUCCESS_MESSAGES,
  VALID_STATUS_TRANSITIONS,
  FNF_EXPENSE_CATEGORIES,
  FNF_EXPENSE_DESCRIPTIONS,
  FNF_EXPENSE_REFERENCE_TYPES,
} from './constants/fnf.constants';
import {
  FnfSettings,
  FnfCalculationResult,
  ClearanceCheckResult,
  ExpenseSettlementResult,
} from './fnf.types';
import { UserService } from '../users/user.service';
import { PayrollService } from '../payroll/payroll.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { FnfDocumentService } from './documents/fnf-document.service';
import { FnfDocumentType } from './documents/fnf-document.constants';
import {
  buildAssignedAssetsQuery,
  buildAssignedVehiclesQuery,
  buildAssignedCardsQuery,
  buildPendingExpenseReimbursementQuery,
  buildPendingFuelReimbursementQuery,
} from './queries/fnf.queries';
import { UserStatus } from '../users/constants/user.constants';
import { ExpenseTrackerService } from '../expense-tracker/expense-tracker.service';

@Injectable()
export class FnfService {
  private readonly logger = new Logger(FnfService.name);

  constructor(
    private readonly fnfRepository: FnfRepository,
    private readonly userService: UserService,
    @Inject(forwardRef(() => PayrollService))
    private readonly payrollService: PayrollService,
    private readonly leaveBalancesService: LeaveBalancesService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
    @Inject(forwardRef(() => FnfDocumentService))
    private readonly fnfDocumentService: FnfDocumentService,
    @Inject(forwardRef(() => ExpenseTrackerService))
    private readonly expenseTrackerService: ExpenseTrackerService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ==================== Main Operations ====================

  async initiate(
    createDto: InitiateFnfDto,
    createdBy: string,
  ): Promise<{ message: string; data: FnfEntity }> {
    await this.userService.findOneOrFail({ where: { id: createDto.userId } });

    const existingFnf = await this.fnfRepository.findOne({
      where: {
        userId: createDto.userId,
        status: FnfStatus.INITIATED,
      },
    });

    if (existingFnf) {
      const activeFnf = await this.fnfRepository.findOne({
        where: {
          userId: createDto.userId,
        },
      });
      if (
        activeFnf &&
        ![FnfStatus.COMPLETED, FnfStatus.CANCELLED].includes(activeFnf.status as FnfStatus)
      ) {
        throw new BadRequestException(FNF_ERRORS.USER_ALREADY_HAS_FNF);
      }
    }

    const exitDate = this.dateTimeService.toDate(createDto.exitDate);
    const lastWorkingDate = this.dateTimeService.toDate(createDto.lastWorkingDate);

    if (lastWorkingDate > exitDate) {
      throw new BadRequestException(FNF_ERRORS.INVALID_LAST_WORKING_DATE);
    }

    // Check clearance status
    const clearanceCheck = await this.checkClearanceStatus(createDto.userId);

    // Create FNF record
    const fnfData: Partial<FnfEntity> = {
      userId: createDto.userId,
      exitDate,
      exitReason: createDto.exitReason,
      lastWorkingDate,
      remarks: createDto.remarks,
      status: FnfStatus.INITIATED,
      createdBy,
      assetsClearanceStatus:
        clearanceCheck.assets.pending > 0 ? ClearanceStatus.PENDING : ClearanceStatus.CLEARED,
      vehiclesClearanceStatus:
        clearanceCheck.vehicles.pending > 0 ? ClearanceStatus.PENDING : ClearanceStatus.CLEARED,
      cardsClearanceStatus:
        clearanceCheck.cards.pending > 0 ? ClearanceStatus.PENDING : ClearanceStatus.CLEARED,
    };

    const fnf = await this.dataSource.transaction(async (entityManager) => {
      const createdFnf = await this.fnfRepository.create(fnfData, entityManager);

      // Update user exit details
      await this.userService.update(
        { id: createDto.userId },
        {
          exitDate,
          exitReason: createDto.exitReason,
          lastWorkingDate,
          exitRemarks: createDto.remarks,
          noticePeriodWaived: createDto.noticePeriodWaived || false,
          updatedBy: createdBy,
        },
      );

      return createdFnf;
    });

    return {
      message: FNF_SUCCESS_MESSAGES.FNF_INITIATED,
      data: fnf,
    };
  }

  async findAll(query: FnfQueryDto) {
    return this.fnfRepository.findAll({ where: query as any });
  }

  async findOne(id: string): Promise<FnfEntity> {
    const fnf = await this.fnfRepository.findOne({
      where: { id },
      relations: ['user', 'calculatedByUser', 'approvedByUser', 'completedByUser'],
    });

    if (!fnf) {
      throw new NotFoundException(FNF_ERRORS.FNF_NOT_FOUND);
    }

    return fnf;
  }

  async calculate(
    id: string,
    calculatedBy: string,
    timezone?: string,
  ): Promise<{ message: string; data: FnfEntity }> {
    const fnf = await this.findOne(id);

    // Validate status transition
    this.validateStatusTransition(fnf.status as FnfStatus, FnfStatus.CALCULATED);

    const settings = await this.getFnfSettings();

    const user = await this.userService.findOneOrFail({ where: { id: fnf.userId } });

    const calculation = await this.calculateFnfAmounts(fnf, user, settings, timezone);

    await this.fnfRepository.update(
      { id },
      {
        ...calculation,
        status: FnfStatus.CALCULATED,
        calculatedAt: new Date(),
        calculatedBy,
        updatedBy: calculatedBy,
      },
    );

    const updatedFnf = await this.findOne(id);

    return {
      message: FNF_SUCCESS_MESSAGES.FNF_CALCULATED,
      data: updatedFnf,
    };
  }

  async update(
    id: string,
    updateDto: UpdateFnfDto,
    updatedBy: string,
  ): Promise<{ message: string; data: FnfEntity }> {
    const fnf = await this.findOne(id);

    // Only allow updates in CALCULATED status
    if (![FnfStatus.CALCULATED, FnfStatus.PENDING_CLEARANCE].includes(fnf.status as FnfStatus)) {
      throw new BadRequestException(FNF_ERRORS.UPDATE_IN_INVALID_STATUS);
    }

    // Merge existing values with updates for recalculation
    const mergedFnf = { ...fnf, ...updateDto };
    const totalEarnings = this.calculateTotalEarnings(mergedFnf as FnfEntity);
    const totalDeductions = this.calculateTotalDeductions(mergedFnf as FnfEntity);
    const netPayable = totalEarnings - totalDeductions;

    await this.fnfRepository.update(
      { id },
      {
        ...updateDto,
        totalEarnings,
        totalDeductions,
        netPayable,
        updatedBy,
      },
    );

    return {
      message: FNF_SUCCESS_MESSAGES.FNF_UPDATED,
      data: await this.findOne(id),
    };
  }

  async updateClearance(
    id: string,
    updateDto: UpdateClearanceDto,
    updatedBy: string,
  ): Promise<{ message: string; data: FnfEntity }> {
    const fnf = await this.findOne(id);

    if ([FnfStatus.COMPLETED, FnfStatus.CANCELLED].includes(fnf.status as FnfStatus)) {
      throw new BadRequestException(FNF_ERRORS.CLEARANCE_UPDATE_NOT_ALLOWED);
    }

    await this.fnfRepository.update(
      { id },
      {
        ...updateDto,
        updatedBy,
      },
    );

    const updatedFnf = await this.findOne(id);

    // Check if all clearances are done and update status
    if (fnf.status === FnfStatus.CALCULATED && this.allClearancesDone(updatedFnf)) {
      // Can proceed to approval
    } else if (!this.allClearancesDone(updatedFnf)) {
      if (fnf.status === FnfStatus.CALCULATED) {
        await this.fnfRepository.update({ id }, { status: FnfStatus.PENDING_CLEARANCE });
      }
    }

    return {
      message: FNF_SUCCESS_MESSAGES.CLEARANCE_UPDATED,
      data: await this.findOne(id),
    };
  }

  async getClearanceStatus(id: string): Promise<ClearanceCheckResult> {
    const fnf = await this.findOne(id);
    return this.checkClearanceStatus(fnf.userId);
  }

  async approve(id: string, approvedBy: string): Promise<{ message: string; data: FnfEntity }> {
    const fnf = await this.findOne(id);

    // Validate status
    if (fnf.status === FnfStatus.INITIATED) {
      throw new BadRequestException(FNF_ERRORS.NOT_CALCULATED);
    }

    this.validateStatusTransition(fnf.status as FnfStatus, FnfStatus.APPROVED);

    // Check clearances
    const settings = await this.getFnfSettings();
    const pendingClearances: string[] = [];

    if (
      settings.assetClearance.blockFnfIfPending &&
      fnf.assetsClearanceStatus !== ClearanceStatus.CLEARED
    ) {
      pendingClearances.push('Assets');
    }
    if (
      settings.vehicleClearance.blockFnfIfPending &&
      fnf.vehiclesClearanceStatus !== ClearanceStatus.CLEARED
    ) {
      pendingClearances.push('Vehicles');
    }
    if (
      settings.cardClearance.blockFnfIfPending &&
      fnf.cardsClearanceStatus !== ClearanceStatus.CLEARED
    ) {
      pendingClearances.push('Cards');
    }

    if (pendingClearances.length > 0) {
      throw new BadRequestException(
        FNF_ERRORS.CLEARANCE_PENDING.replace('{items}', pendingClearances.join(', ')),
      );
    }

    await this.fnfRepository.update(
      { id },
      {
        status: FnfStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy,
        updatedBy: approvedBy,
      },
    );

    return {
      message: FNF_SUCCESS_MESSAGES.FNF_APPROVED,
      data: await this.findOne(id),
    };
  }

  async complete(id: string, completedBy: string): Promise<{ message: string; data: FnfEntity }> {
    const fnf = await this.findOne(id);

    if (fnf.status !== FnfStatus.DOCUMENTS_GENERATED) {
      throw new BadRequestException(FNF_ERRORS.DOCUMENTS_NOT_GENERATED);
    }

    const settings = await this.getFnfSettings();
    const user = await this.userService.findOneOrFail({ where: { id: fnf.userId } });

    // Auto-credit leave encashment if enabled and payment mode is EXPENSE
    if (
      settings.leaveEncashment.enabled &&
      settings.leaveEncashment.paymentMode === 'EXPENSE' &&
      Number(fnf.leaveEncashmentAmount) > 0
    ) {
      const description = FNF_EXPENSE_DESCRIPTIONS.LEAVE_ENCASHMENT.replace(
        '{days}',
        String(fnf.encashableLeaves),
      ).replace('{dailySalary}', String(fnf.dailySalary));

      await this.expenseTrackerService.createSystemExpense({
        userId: fnf.userId,
        category: FNF_EXPENSE_CATEGORIES.LEAVE_ENCASHMENT,
        amount: Number(fnf.leaveEncashmentAmount),
        description,
        createdBy: completedBy,
        referenceId: fnf.id,
        referenceType: FNF_EXPENSE_REFERENCE_TYPES.LEAVE_ENCASHMENT,
      });

      this.logger.log(
        `Auto-credited leave encashment of ₹${fnf.leaveEncashmentAmount} for user ${user.firstName} ${user.lastName}`,
      );
    }

    await this.fnfRepository.update(
      { id },
      {
        status: FnfStatus.COMPLETED,
        completedAt: new Date(),
        completedBy,
        updatedBy: completedBy,
      },
    );

    // Archive user
    await this.userService.update({ id: fnf.userId }, { status: UserStatus.ARCHIVED });

    return {
      message: FNF_SUCCESS_MESSAGES.FNF_COMPLETED,
      data: await this.findOne(id),
    };
  }

  async cancel(id: string, cancelledBy: string, remarks?: string): Promise<{ message: string }> {
    const fnf = await this.findOne(id);

    if ([FnfStatus.COMPLETED, FnfStatus.CANCELLED].includes(fnf.status as FnfStatus)) {
      throw new BadRequestException(
        fnf.status === FnfStatus.COMPLETED
          ? FNF_ERRORS.ALREADY_COMPLETED
          : FNF_ERRORS.ALREADY_CANCELLED,
      );
    }

    await this.fnfRepository.update(
      { id },
      {
        status: FnfStatus.CANCELLED,
        remarks: remarks || fnf.remarks,
        updatedBy: cancelledBy,
      },
    );

    // Clear user exit details
    await this.userService.update(
      { id: fnf.userId },
      {
        exitDate: null,
        exitReason: null,
        lastWorkingDate: null,
        exitRemarks: null,
        noticePeriodWaived: false,
        updatedBy: cancelledBy,
      },
    );

    return { message: FNF_SUCCESS_MESSAGES.FNF_CANCELLED };
  }

  // ==================== Calculation Methods ====================

  /**
   * Calculate FNF amounts using PayrollService for proper salary calculation.
   * This ensures consistency with regular payroll calculation including:
   * - Working days based on configuration (excludes weekends)
   * - Pro-rated salary components (Basic, HRA, allowances)
   * - Attendance-based deductions (LOP, absent days)
   * - Pro-rated statutory deductions (PF, TDS, ESIC, PT)
   */
  private async calculateFnfAmounts(
    fnf: FnfEntity,
    user: any,
    settings: FnfSettings,
    timezone?: string,
  ): Promise<FnfCalculationResult> {
    // Calculate salary using PayrollService (reusable, consistent with regular payroll)
    const lastWorkingDate = this.dateTimeService.toDate(
      this.dateTimeService.toDateString(new Date(fnf.lastWorkingDate)),
    );

    const salaryBreakdown = await this.payrollService.calculateFnfSalary({
      userId: fnf.userId,
      lastWorkingDate,
    });

    const { dailySalary, daysWorked, netSalary: finalSalary } = salaryBreakdown;

    // Leave encashment calculation
    let encashableLeaves = 0;
    let leaveEncashmentAmount = 0;

    if (settings.leaveEncashment.enabled) {
      const financialYear = this.utilityService.getFinancialYear(new Date());
      const leaveBalances = await this.leaveBalancesService.getAllLeaveBalances({
        userIds: [fnf.userId],
        financialYear,
      });

      // Filter for encashable categories (earned leave)
      for (const balance of leaveBalances.records) {
        if (settings.leaveEncashment.categories.includes(balance.leaveCategory)) {
          const available = Number(balance.totalAllocated) - Number(balance.consumed);
          encashableLeaves += Math.max(0, available);
        }
      }

      // Apply max days cap if set
      if (settings.leaveEncashment.maxDays && encashableLeaves > settings.leaveEncashment.maxDays) {
        encashableLeaves = settings.leaveEncashment.maxDays;
      }

      leaveEncashmentAmount = encashableLeaves * dailySalary;
    }

    let serviceYears = 0;
    let gratuityAmount = 0;

    if (settings.gratuity.enabled && user.dateOfJoining) {
      const joiningDate = this.dateTimeService.toDate(
        this.dateTimeService.toDateString(new Date(user.dateOfJoining)),
      );
      const diffMs = lastWorkingDate.getTime() - joiningDate.getTime();
      serviceYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

      if (serviceYears >= settings.gratuity.minServiceYears) {
        // Standard gratuity formula: 15 days salary per year of service
        gratuityAmount = 15 * dailySalary * Math.floor(serviceYears);

        // Apply max cap if set
        if (settings.gratuity.maxAmount && gratuityAmount > settings.gratuity.maxAmount) {
          gratuityAmount = settings.gratuity.maxAmount;
        }
      }
    }

    // Notice period recovery calculation
    let noticePeriodDays = 0;
    let noticePeriodRecovery = 0;

    if (settings.noticePeriod.enabled && !user.noticePeriodWaived) {
      const today = this.dateTimeService.getStartOfToday(timezone);
      const noticeDaysRequired = settings.noticePeriod.days;
      const actualNoticeDays = Math.ceil(
        (lastWorkingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (actualNoticeDays < noticeDaysRequired && settings.noticePeriod.recoveryEnabled) {
        noticePeriodDays = noticeDaysRequired - Math.max(0, actualNoticeDays);
        noticePeriodRecovery = noticePeriodDays * dailySalary;
      }
    }

    // Expense and Fuel Settlement
    const expenseSettlement = await this.calculateExpenseSettlement(fnf.userId, settings);

    // Calculate totals
    // Note: finalSalary already includes salary deductions (PF, TDS, etc.) from payroll calculation
    // FNF total earnings = final salary (net) + leave encashment + gratuity + pending reimbursements
    const totalEarnings =
      finalSalary +
      leaveEncashmentAmount +
      gratuityAmount +
      expenseSettlement.pendingExpenseReimbursement +
      expenseSettlement.pendingFuelReimbursement;

    // FNF total deductions = notice period recovery + unsettled credits
    const totalDeductions =
      noticePeriodRecovery +
      expenseSettlement.unsettledExpenseCredit +
      expenseSettlement.unsettledFuelCredit;

    const netPayable = totalEarnings - totalDeductions;

    return {
      daysWorked,
      dailySalary: Math.round(dailySalary * 100) / 100,
      finalSalary: Math.round(finalSalary * 100) / 100,
      salaryBreakdown,
      encashableLeaves: Math.round(encashableLeaves * 10) / 10,
      leaveEncashmentAmount: Math.round(leaveEncashmentAmount * 100) / 100,
      serviceYears: Math.round(serviceYears * 100) / 100,
      gratuityAmount: Math.round(gratuityAmount * 100) / 100,
      pendingExpenseReimbursement:
        Math.round(expenseSettlement.pendingExpenseReimbursement * 100) / 100,
      unsettledExpenseCredit: Math.round(expenseSettlement.unsettledExpenseCredit * 100) / 100,
      pendingFuelReimbursement: Math.round(expenseSettlement.pendingFuelReimbursement * 100) / 100,
      unsettledFuelCredit: Math.round(expenseSettlement.unsettledFuelCredit * 100) / 100,
      noticePeriodDays,
      noticePeriodRecovery: Math.round(noticePeriodRecovery * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
    };
  }

  private async calculateExpenseSettlement(
    userId: string,
    settings: FnfSettings,
  ): Promise<ExpenseSettlementResult> {
    const result: ExpenseSettlementResult = {
      pendingExpenseReimbursement: 0,
      unsettledExpenseCredit: 0,
      expenseDetails: { pendingDebits: 0, unsettledCredits: 0, count: 0 },
      pendingFuelReimbursement: 0,
      unsettledFuelCredit: 0,
      fuelDetails: { pendingDebits: 0, unsettledCredits: 0, count: 0 },
    };

    if (!settings.expenseSettlement?.enabled) {
      return result;
    }

    // Calculate expense settlement
    if (settings.expenseSettlement.includeExpenses) {
      const { query, params } = buildPendingExpenseReimbursementQuery(userId);
      const [expenseResult] = await this.fnfRepository.executeRawQuery(query, params);

      if (expenseResult) {
        result.pendingExpenseReimbursement = Number(expenseResult.pendingDebits) || 0;
        result.unsettledExpenseCredit = Number(expenseResult.unsettledCredits) || 0;
        result.expenseDetails = {
          pendingDebits: result.pendingExpenseReimbursement,
          unsettledCredits: result.unsettledExpenseCredit,
          count: Number(expenseResult.count) || 0,
        };
      }
    }

    // Calculate fuel expense settlement
    if (settings.expenseSettlement.includeFuelExpenses) {
      const { query, params } = buildPendingFuelReimbursementQuery(userId);
      const [fuelResult] = await this.fnfRepository.executeRawQuery(query, params);

      if (fuelResult) {
        result.pendingFuelReimbursement = Number(fuelResult.pendingDebits) || 0;
        result.unsettledFuelCredit = Number(fuelResult.unsettledCredits) || 0;
        result.fuelDetails = {
          pendingDebits: result.pendingFuelReimbursement,
          unsettledCredits: result.unsettledFuelCredit,
          count: Number(fuelResult.count) || 0,
        };
      }
    }

    return result;
  }

  private calculateTotalEarnings(fnf: FnfEntity): number {
    return (
      Number(fnf.finalSalary) +
      Number(fnf.leaveEncashmentAmount) +
      Number(fnf.gratuityAmount) +
      Number(fnf.pendingExpenseReimbursement) +
      Number(fnf.pendingFuelReimbursement) +
      Number(fnf.pendingReimbursements) +
      Number(fnf.otherAdditions)
    );
  }

  private calculateTotalDeductions(fnf: FnfEntity): number {
    return (
      Number(fnf.noticePeriodRecovery) +
      Number(fnf.unsettledExpenseCredit) +
      Number(fnf.unsettledFuelCredit) +
      Number(fnf.otherDeductions)
    );
  }

  // ==================== Clearance Methods ====================

  private async checkClearanceStatus(userId: string): Promise<ClearanceCheckResult> {
    const { query: assetsQuery, params: assetsParams } = buildAssignedAssetsQuery(userId);
    const assets = await this.fnfRepository.executeRawQuery(assetsQuery, assetsParams);

    const { query: vehiclesQuery, params: vehiclesParams } = buildAssignedVehiclesQuery(userId);
    const vehicles = await this.fnfRepository.executeRawQuery(vehiclesQuery, vehiclesParams);

    const { query: cardsQuery, params: cardsParams } = buildAssignedCardsQuery(userId);
    const cards = await this.fnfRepository.executeRawQuery(cardsQuery, cardsParams);

    return {
      assets: {
        assigned: assets.length,
        returned: 0,
        pending: assets.length,
        items: assets.map((asset: any) => `${asset.assetId} - ${asset.name}`),
      },
      vehicles: {
        assigned: vehicles.length,
        returned: 0,
        pending: vehicles.length,
        items: vehicles.map((vehicle: any) => vehicle.registrationNo),
      },
      cards: {
        assigned: cards.length,
        deactivated: 0,
        pending: cards.length,
        items: cards.map((card: any) => `${card.cardType} - ${card.cardNumber}`),
      },
    };
  }

  private allClearancesDone(fnf: FnfEntity): boolean {
    return (
      (fnf.assetsClearanceStatus === ClearanceStatus.CLEARED ||
        fnf.assetsClearanceStatus === ClearanceStatus.NOT_APPLICABLE) &&
      (fnf.vehiclesClearanceStatus === ClearanceStatus.CLEARED ||
        fnf.vehiclesClearanceStatus === ClearanceStatus.NOT_APPLICABLE) &&
      (fnf.cardsClearanceStatus === ClearanceStatus.CLEARED ||
        fnf.cardsClearanceStatus === ClearanceStatus.NOT_APPLICABLE)
    );
  }

  // ==================== Helper Methods ====================

  private async getFnfSettings(): Promise<FnfSettings> {
    const config = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.FNF,
        key: CONFIGURATION_KEYS.FNF_SETTINGS,
      },
    });

    const setting = await this.configSettingService.findOneOrFail({
      where: { configId: config.id, isActive: true },
    });

    return JSON.parse(setting.value);
  }

  private validateStatusTransition(currentStatus: FnfStatus, targetStatus: FnfStatus): void {
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!validTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        FNF_ERRORS.INVALID_STATUS_TRANSITION.replace('{current}', currentStatus).replace(
          '{target}',
          targetStatus,
        ),
      );
    }
  }

  // ==================== Document Operations ====================

  async generateDocuments(
    fnfId: string,
    generatedBy: string,
  ): Promise<{ message: string; data: any }> {
    const fnf = await this.findOne(fnfId);
    const user = await this.userService.findOne({ id: fnf.userId });

    const result = await this.fnfDocumentService.generateAllDocuments(fnf, user, generatedBy);

    return {
      message: FNF_SUCCESS_MESSAGES.DOCUMENTS_GENERATED,
      data: result,
    };
  }

  async getDocumentBuffer(
    fnfId: string,
    documentType: FnfDocumentType,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    const fnf = await this.findOne(fnfId);
    const user = await this.userService.findOne({ id: fnf.userId });

    if (!user) {
      throw new NotFoundException(FNF_ERRORS.USER_NOT_FOUND);
    }

    const buffer = await this.fnfDocumentService.getDocumentBuffer(fnf, user, documentType);
    const fileName = `${documentType.toLowerCase().replace('_', '-')}-${
      user.employeeId || user.id.substring(0, 8)
    }.pdf`;

    return { buffer, fileName };
  }

  async sendDocumentsViaEmail(fnfId: string): Promise<{ message: string }> {
    const fnf = await this.findOne(fnfId);
    const user = await this.userService.findOne({ id: fnf.userId });

    if (!user) {
      throw new NotFoundException(FNF_ERRORS.USER_NOT_FOUND);
    }

    await this.fnfDocumentService.sendDocumentsViaEmail(fnf, user);

    return { message: FNF_SUCCESS_MESSAGES.DOCUMENTS_SENT };
  }
}
