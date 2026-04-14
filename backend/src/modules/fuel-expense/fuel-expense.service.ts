import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { FuelExpenseRepository } from './fuel-expense.repository';
import {
  CreateFuelExpenseDto,
  CreateCreditFuelExpenseDto,
  EditFuelExpenseDto,
  FuelExpenseQueryDto,
  FuelExpenseApprovalDto,
  FuelExpenseBulkApprovalDto,
  FuelExpenseListResponseDto,
  BulkDeleteFuelExpenseDto,
} from './dto';
import {
  FUEL_EXPENSE_ERRORS,
  FUEL_EXPENSE_SUCCESS_MESSAGES,
  FUEL_EXPENSE_EMAIL_CONSTANTS,
  ApprovalStatus,
  DEFAULT_FUEL_EXPENSE,
  TransactionType,
  ExpenseEntryType,
  FuelExpenseEntityFields,
} from './constants/fuel-expense.constants';
import { FuelExpenseEntity } from './entities/fuel-expense.entity';
import {
  DataSource,
  EntityManager,
  Equal,
  FindOneOptions,
  In,
  LessThan,
  MoreThan,
  Not,
} from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { FuelExpenseFilesService } from '../fuel-expense-files/fuel-expense-files.service';
import { VehicleMastersService } from '../vehicle-masters/vehicle-masters.service';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { VehicleStatus } from '../vehicle-masters/constants/vehicle-masters.constants';
import { CardsService } from '../cards/cards.service';
import { UserService } from '../users/user.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
  EntrySourceType,
} from 'src/utils/master-constants/master-constants';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime';
import {
  buildFuelExpenseListQuery,
  buildFuelExpenseBalanceQuery,
  buildProjectedFuelBalanceQuery,
  buildFuelExpenseSummaryQuery,
} from './queries/fuel-expense.queries';
import { EmailService } from '../common/email/email.service';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { Environments } from 'env-configs';
import {
  EMAIL_SUBJECT,
  EMAIL_TEMPLATE,
  EMAIL_REDIRECT_ROUTES,
} from '../common/email/constants/email.constants';

@Injectable()
export class FuelExpenseService {
  constructor(
    private readonly fuelExpenseRepository: FuelExpenseRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fuelExpenseFilesService: FuelExpenseFilesService,
    private readonly vehicleMastersService: VehicleMastersService,
    private readonly vehicleVersionsService: VehicleVersionsService,
    @Inject(forwardRef(() => CardsService))
    private readonly cardsService: CardsService,
    private readonly userService: UserService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async create(
    createFuelExpenseDto: CreateFuelExpenseDto & {
      userId: string;
      createdBy: string;
      fileKeys: string[];
      entrySourceType: string;
      timezone?: string;
    },
  ) {
    try {
      const {
        vehicleId,
        cardId: providedCardId,
        fillDate,
        odometerKm,
        userId,
        createdBy,
        fileKeys,
        paymentMode,
        transactionType = TransactionType.DEBIT,
        expenseEntryType = ExpenseEntryType.SELF,
        timezone,
      } = createFuelExpenseDto;

      await this.validateFillDate(fillDate, timezone);
      await this.validatePaymentMode(paymentMode);

      const vehicle = await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      await this.validateVehicleAssignment(vehicleId, userId);

      let cardId = providedCardId;
      if (!cardId) {
        const vehicleCard = await this.cardsService.findByVehicleId(vehicleId);
        if (vehicleCard) {
          cardId = vehicleCard.id;
        }
      } else {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      const cardRequiredModes = [TransactionType.PETRO_CARD];
      if (cardRequiredModes.includes(paymentMode as TransactionType) && !cardId) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.CARD_REQUIRED_FOR_PAYMENT_MODE);
      }

      const employee = await this.userService.findOneOrFail({ where: { id: userId } });

      await this.validateOdometerReading(vehicleId, odometerKm, fillDate);

      const result = await this.dataSource.transaction(async (entityManager) => {
        const fuelExpense = await this.fuelExpenseRepository.create(
          {
            ...createFuelExpenseDto,
            cardId,
            approvalStatus: ApprovalStatus.PENDING,
            isActive: true,
            versionNumber: 1,
            createdBy,
            transactionType,
            expenseEntryType,
          },
          entityManager,
        );

        if (fileKeys && fileKeys.length > 0) {
          await this.fuelExpenseFilesService.create(
            {
              fuelExpenseId: fuelExpense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }

        return { message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_CREATED, id: fuelExpense.id };
      });

      // Send WhatsApp notification to employee (non-blocking)
      try {
        const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
        if (employee.whatsappOptIn && whatsappNumber) {
          await this.whatsAppService.sendFuelExpenseSubmitted(
            whatsappNumber,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              amount: `₹${Number(createFuelExpenseDto.fuelAmount).toLocaleString('en-IN')}`,
              vehicleNumber: vehicle.registrationNo,
            },
            { referenceId: result.id, recipientId: employee.id },
          );
        }
      } catch (err) {
        Logger.error('Failed to send fuel expense submitted WhatsApp notification:', err);
      }

      return { message: result.message };
    } catch (error) {
      throw error;
    }
  }

  async forceFuelExpense(
    createFuelExpenseDto: CreateFuelExpenseDto & {
      userId: string;
      createdBy: string;
      fileKeys: string[];
      entrySourceType: string;
      timezone?: string;
    },
  ) {
    try {
      const {
        vehicleId,
        cardId: providedCardId,
        fillDate,
        odometerKm,
        userId,
        createdBy,
        fileKeys,
        paymentMode,
        expenseEntryType = ExpenseEntryType.FORCED,
        transactionType = TransactionType.DEBIT,
        timezone,
      } = createFuelExpenseDto;

      // Validate fill date - use timezone-aware comparison
      const fillDateStr = this.dateTimeService.toDateString(new Date(fillDate));
      if (this.dateTimeService.isFutureDate(fillDateStr, timezone)) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.INVALID_FILL_DATE);
      }

      // Validate payment mode
      await this.validatePaymentMode(paymentMode);

      const vehicle = await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      await this.validateVehicleAssignment(vehicleId, userId);

      let cardId = providedCardId;
      if (!cardId) {
        const vehicleCard = await this.cardsService.findByVehicleId(vehicleId);
        if (vehicleCard) {
          cardId = vehicleCard.id;
        }
      } else {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      const cardRequiredModes = [TransactionType.PETRO_CARD];
      if (cardRequiredModes.includes(paymentMode as TransactionType) && !cardId) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.CARD_REQUIRED_FOR_PAYMENT_MODE);
      }

      const employee = await this.userService.findOneOrFail({ where: { id: userId } });
      const admin = await this.userService.findOne({ id: createdBy });

      await this.validateOdometerReading(vehicleId, odometerKm, fillDate);

      const result = await this.dataSource.transaction(async (entityManager) => {
        const fuelExpense = await this.fuelExpenseRepository.create(
          {
            ...createFuelExpenseDto,
            cardId,
            approvalStatus: ApprovalStatus.APPROVED,
            approvalAt: new Date(),
            approvalBy: createdBy,
            approvalReason: DEFAULT_FUEL_EXPENSE.FORCE_APPROVAL_REASON,
            isActive: true,
            versionNumber: 1,
            createdBy,
            transactionType,
            expenseEntryType,
          },
          entityManager,
        );

        if (fileKeys && fileKeys.length > 0) {
          await this.fuelExpenseFilesService.create(
            {
              fuelExpenseId: fuelExpense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }

        return {
          message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_FORCE_CREATED,
          id: fuelExpense.id,
        };
      });

      // Send WhatsApp force-created notification to employee (non-blocking)
      try {
        const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
        if (employee.whatsappOptIn && whatsappNumber) {
          const adminName = admin
            ? `${admin.firstName} ${admin.lastName}`
            : FUEL_EXPENSE_EMAIL_CONSTANTS.SYSTEM_USER;
          await this.whatsAppService.sendFuelExpenseForceCreated(
            whatsappNumber,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              amount: `₹${Number(createFuelExpenseDto.fuelAmount).toLocaleString('en-IN')}`,
              vehicleNumber: vehicle.registrationNo,
              createdByName: adminName,
            },
            { referenceId: result.id, recipientId: employee.id },
          );
        }
      } catch (err) {
        Logger.error('Failed to send force fuel expense WhatsApp notification:', err);
      }

      return { message: result.message };
    } catch (error) {
      throw error;
    }
  }

  async createCreditFuelExpense(
    createCreditFuelExpenseDto: CreateCreditFuelExpenseDto & {
      createdBy: string;
      fileKeys: string[];
      entrySourceType: string;
      timezone?: string;
    },
  ) {
    try {
      const { fillDate, userId, createdBy, fileKeys, paymentMode, entrySourceType, timezone } =
        createCreditFuelExpenseDto;

      // Validate settlement date (no future dates) - use timezone-aware comparison
      const fillDateStr = this.dateTimeService.toDateString(new Date(fillDate));
      if (this.dateTimeService.isFutureDate(fillDateStr, timezone)) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.INVALID_FILL_DATE);
      }

      // Validate payment mode
      await this.validatePaymentMode(paymentMode);

      // Validate user exists
      const employee = await this.userService.findOneOrFail({ where: { id: userId } });
      const admin = await this.userService.findOne({ id: createdBy });

      const result = await this.dataSource.transaction(async (entityManager) => {
        // Create fuel expense credit/settlement record (auto-approved)
        const fuelExpense = await this.fuelExpenseRepository.create(
          {
            ...createCreditFuelExpenseDto,
            approvalStatus: ApprovalStatus.APPROVED,
            approvalAt: new Date(),
            approvalBy: createdBy,
            approvalReason: DEFAULT_FUEL_EXPENSE.CREDIT_APPROVAL_REASON,
            isActive: true,
            versionNumber: 1,
            createdBy,
            transactionType: TransactionType.CREDIT,
            expenseEntryType: ExpenseEntryType.SELF,
            entrySourceType,
          },
          entityManager,
        );

        // Create file attachments if provided
        if (fileKeys && fileKeys.length > 0) {
          await this.fuelExpenseFilesService.create(
            {
              fuelExpenseId: fuelExpense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }

        return {
          message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_CREDIT_SETTLED,
          id: fuelExpense.id,
        };
      });

      // Send WhatsApp reimbursement notification to employee (non-blocking)
      try {
        const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
        if (employee.whatsappOptIn && whatsappNumber) {
          const adminName = admin
            ? `${admin.firstName} ${admin.lastName}`
            : FUEL_EXPENSE_EMAIL_CONSTANTS.SYSTEM_USER;
          await this.whatsAppService.sendFuelExpenseReimbursed(
            whatsappNumber,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              amount: `₹${Number(createCreditFuelExpenseDto.fuelAmount).toLocaleString('en-IN')}`,
              processedBy: adminName,
            },
            { referenceId: result.id, recipientId: employee.id },
          );
        }
      } catch (err) {
        Logger.error('Failed to send fuel expense reimbursement WhatsApp notification:', err);
      }

      return { message: result.message };
    } catch (error) {
      throw error;
    }
  }

  async editFuelExpense(
    editFuelExpenseDto: EditFuelExpenseDto & {
      id: string;
      updatedBy: string;
      fileKeys?: string[];
      entrySourceType: string;
      timezone?: string;
    },
  ) {
    try {
      const { id, updatedBy, editReason, fileKeys, entrySourceType, timezone } = editFuelExpenseDto;
      const fuelExpense = await this.findOneOrFail({ where: { id, isActive: true } });

      // Check if creator is editing
      if (fuelExpense.createdBy !== updatedBy) {
        throw new BadRequestException(
          FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_EDITED_BY_OTHER_USER,
        );
      }

      // Check if fuel expense can be edited (only PENDING status can be edited)
      if (fuelExpense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_EDITED);
      }

      const {
        vehicleId,
        cardId: providedCardId,
        fillDate,
        odometerKm,
        paymentMode,
      } = editFuelExpenseDto;

      // Validate fill date
      await this.validateFillDate(fillDate, timezone);

      // Validate payment mode
      await this.validatePaymentMode(paymentMode);

      // Validate vehicle exists
      await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      let cardId = providedCardId;
      if (!cardId) {
        const vehicleCard = await this.cardsService.findByVehicleId(vehicleId);
        if (vehicleCard) {
          cardId = vehicleCard.id;
        }
      } else {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      if (paymentMode === TransactionType.PETRO_CARD && !cardId) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.CARD_REQUIRED_FOR_PAYMENT_MODE);
      }

      // Validate odometer reading
      await this.validateOdometerReading(vehicleId, odometerKm, fillDate, id);

      return await this.dataSource.transaction(async (entityManager) => {
        // Deactivate the old fuel expense record
        await this.fuelExpenseRepository.update(
          { id },
          { isActive: false, updatedBy },
          entityManager,
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, ...editData } = editFuelExpenseDto;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: __, ...fuelExpenseData } = fuelExpense;

        // Calculate history tracking fields
        const originalFuelExpenseId = fuelExpense.originalFuelExpenseId || fuelExpense.id;
        const parentFuelExpenseId = fuelExpense.id;
        const versionNumber = fuelExpense.versionNumber + 1;

        // Create new version of fuel expense
        const newFuelExpense = await this.fuelExpenseRepository.create(
          {
            ...fuelExpenseData,
            ...editData,
            cardId,
            isActive: true,
            updatedBy,
            originalFuelExpenseId,
            parentFuelExpenseId,
            versionNumber,
            editReason: editReason || DEFAULT_FUEL_EXPENSE.EDIT_REASON,
            approvalStatus: ApprovalStatus.PENDING, // Reset to pending after edit
            approvalBy: null,
            approvalReason: null,
            approvalAt: null,
            transactionType: fuelExpense.transactionType,
            expenseEntryType: fuelExpense.expenseEntryType,
            entrySourceType,
          },
          entityManager,
        );

        // Create file attachments if provided
        if (fileKeys && fileKeys.length > 0) {
          await this.fuelExpenseFilesService.create(
            {
              fuelExpenseId: newFuelExpense.id,
              fileKeys,
              createdBy: updatedBy,
            },
            entityManager,
          );
        }

        return this.utilityService.getSuccessMessage(
          FuelExpenseEntityFields.FUEL_EXPENSE,
          DataSuccessOperationType.UPDATE,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOneOptions<FuelExpenseEntity>) {
    try {
      return await this.fuelExpenseRepository.findOne(options);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(
    options: FindOneOptions<FuelExpenseEntity>,
    entityManager?: EntityManager,
  ): Promise<FuelExpenseEntity> {
    try {
      // Ensure we're looking for active records unless explicitly specified
      if (options.where && typeof options.where === 'object' && !('isActive' in options.where)) {
        (options.where as any).isActive = true;
      }

      const fuelExpense = await this.fuelExpenseRepository.findOne(options, entityManager);

      if (!fuelExpense) {
        throw new NotFoundException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_NOT_FOUND);
      }

      return fuelExpense;
    } catch (error) {
      throw error;
    }
  }

  async getFuelExpenseRecords(
    fuelExpenseQueryDto: FuelExpenseQueryDto,
    currentUserId?: string,
  ): Promise<FuelExpenseListResponseDto> {
    try {
      const { ...filters } = fuelExpenseQueryDto;

      // Build all queries using the query builder functions
      const { query, countQuery, params, countParams } = buildFuelExpenseListQuery(filters);
      const { openingBalanceQuery, openingBalanceParams, periodTotalsQuery, periodParams } =
        buildFuelExpenseBalanceQuery(filters);
      const {
        openingBalanceQuery: projOpeningQuery,
        openingBalanceParams: projOpeningParams,
        periodTotalsQuery: projPeriodQuery,
        periodParams: projPeriodParams,
      } = buildProjectedFuelBalanceQuery(filters);
      const { summaryQuery, params: summaryParams } = buildFuelExpenseSummaryQuery(filters);

      // Execute all queries in parallel for better performance
      const [
        records,
        [{ total }],
        openingBalanceResult,
        periodTotalsResult,
        projOpeningResult,
        projPeriodResult,
        [summaryResult],
      ] = await Promise.all([
        this.fuelExpenseRepository.executeRawQuery(query, params),
        this.fuelExpenseRepository.executeRawQuery(countQuery, countParams),
        this.fuelExpenseRepository.executeRawQuery(openingBalanceQuery, openingBalanceParams),
        this.fuelExpenseRepository.executeRawQuery(periodTotalsQuery, periodParams),
        this.fuelExpenseRepository.executeRawQuery(projOpeningQuery, projOpeningParams),
        this.fuelExpenseRepository.executeRawQuery(projPeriodQuery, projPeriodParams),
        this.fuelExpenseRepository.executeRawQuery(summaryQuery, summaryParams),
      ]);

      // Calculate opening balance
      const openingBalance =
        openingBalanceResult.length > 0
          ? openingBalanceResult[0]
          : { totalCredit: 0, totalDebit: 0 };
      const openingBalanceAmount =
        Number(openingBalance.totalCredit) - Number(openingBalance.totalDebit);

      // Calculate period totals
      const periodTotals =
        periodTotalsResult.length > 0 ? periodTotalsResult[0] : { periodCredit: 0, periodDebit: 0 };
      const periodCredit = Number(periodTotals.periodCredit);
      const periodDebit = Number(periodTotals.periodDebit);

      // Calculate closing balance
      const closingBalanceAmount = openingBalanceAmount + periodCredit - periodDebit;

      // Calculate projected balances (approved + pending)
      const projOpening =
        projOpeningResult.length > 0 ? projOpeningResult[0] : { totalCredit: 0, totalDebit: 0 };
      const projOpeningAmount = Number(projOpening.totalCredit) - Number(projOpening.totalDebit);

      const projPeriod =
        projPeriodResult.length > 0 ? projPeriodResult[0] : { periodCredit: 0, periodDebit: 0 };
      const projPeriodCredit = Number(projPeriod.periodCredit);
      const projPeriodDebit = Number(projPeriod.periodDebit);
      const projClosingAmount = projOpeningAmount + projPeriodCredit - projPeriodDebit;

      // Summary data
      const summary = summaryResult || {
        totalCredit: 0,
        totalDebit: 0,
        totalCreditCardExpense: 0,
        totalRecords: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      };

      // Get fuel expense files for all records
      const fuelExpenseFiles = await this.fuelExpenseFilesService.findAll({
        where: {
          fuelExpenseId: In(records.map((record: any) => record.id)),
        },
        select: ['id', 'fileKey', 'fuelExpenseId'],
      });

      // Calculate vehicle average only if vehicleId is filtered AND no other data filters are applied
      // When other filters are applied (date, approval status, etc.), the average would be incorrect
      let vehicleAverage = null;
      const hasDataFilters =
        filters.startDate ||
        filters.endDate ||
        filters.date ||
        (filters.approvalStatuses && filters.approvalStatuses.length > 0) ||
        filters.search ||
        (filters.paymentModes && filters.paymentModes.length > 0) ||
        filters.cardId;

      if (filters.vehicleId && !hasDataFilters) {
        try {
          const avgData = await this.calculateVehicleAverage(filters.vehicleId);
          vehicleAverage = {
            ...avgData,
            vehicleId: filters.vehicleId,
          };
        } catch (error) {
          // If there's insufficient data or error, vehicle average will remain null
          Logger.warn(
            FUEL_EXPENSE_ERRORS.COULD_NOT_CALCULATE_VEHICLE_AVERAGE.replace(
              '{error}',
              error.message || error,
            ),
          );
        }
      }

      // Transform records to include all necessary information
      const transformedRecords = records.map((record: any) => {
        // Calculate fuel efficiency only if no data filters are applied
        // When filters are applied, LAG() operates on filtered data which gives incorrect results
        let fuelEfficiency = null;
        if (
          filters.vehicleId &&
          !hasDataFilters &&
          record.previousOdometerKm &&
          Number(record.previousOdometerKm) > 0
        ) {
          const distanceTraveled = Number(record.odometerKm) - Number(record.previousOdometerKm);
          const fuelLiters = Number(record.fuelLiters);

          if (distanceTraveled > 0 && fuelLiters > 0) {
            const currentKmPerLiter = Number((distanceTraveled / fuelLiters).toFixed(2));

            // Calculate previous efficiency if we have the data
            let previousKmPerLiter = null;
            let efficiencyChange = null;
            let efficiencyChangePercent = null;

            if (
              record.secondPreviousOdometerKm &&
              record.previousFuelLiters &&
              Number(record.previousFuelLiters) > 0
            ) {
              const previousDistance =
                Number(record.previousOdometerKm) - Number(record.secondPreviousOdometerKm);
              if (previousDistance > 0) {
                previousKmPerLiter = Number(
                  (previousDistance / Number(record.previousFuelLiters)).toFixed(2),
                );

                // Calculate percentage change: positive = improvement, negative = decline
                const change = currentKmPerLiter - previousKmPerLiter;
                efficiencyChange = Number(change.toFixed(2));
                efficiencyChangePercent = Number(((change / previousKmPerLiter) * 100).toFixed(2));
              }
            }

            fuelEfficiency = {
              distanceTraveled: distanceTraveled,
              kmPerLiter: currentKmPerLiter,
              previousOdometerKm: Number(record.previousOdometerKm),
              previousKmPerLiter,
              efficiencyChange,
              efficiencyChangePercent,
            };
          }
        }

        return {
          id: record.id,
          userId: record.userId,
          createdBy: record.createdBy ?? null,
          createdByUser: record.createdBy
            ? {
                id: record.createdBy,
                firstName: record.createdByFirstName,
                lastName: record.createdByLastName,
                email: record.createdByEmail,
                employeeId: record.createdByEmployeeId,
              }
            : null,
          canEdit: Boolean(
            currentUserId &&
              record.createdBy === currentUserId &&
              record.approvalStatus === ApprovalStatus.PENDING,
          ),
          user: {
            id: record.userId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            employeeId: record.employeeId,
          },
          vehicle: record.vehicleId
            ? {
                id: record.vehicleId,
                registrationNo: record.registrationNumber,
                brand: record.vehicleBrand,
                model: record.vehicleModel,
                fuelType: record.vehicleFuelType,
                mileage: record.vehicleMileage,
                status: record.vehicleStatus,
              }
            : null,
          card: record.cardId
            ? {
                id: record.cardId,
                cardNumber: record.cardNumber,
                cardType: record.cardType,
              }
            : null,
          approvalByUser: record.approvalBy
            ? {
                id: record.approvalBy,
                firstName: record.approvalByFirstName,
                lastName: record.approvalByLastName,
                email: record.approvalByEmail,
                employeeId: record.approvalByEmployeeId,
              }
            : null,
          fillDate: record.fillDate,
          odometerKm: Number(record.odometerKm),
          fuelLiters: Number(record.fuelLiters),
          fuelAmount: Number(record.fuelAmount),
          pumpMeterReading: record.pumpMeterReading ? Number(record.pumpMeterReading) : null,
          paymentMode: record.paymentMode,
          transactionId: record.transactionId,
          description: record.description,
          transactionType: record.transactionType,
          expenseEntryType: record.expenseEntryType,
          entrySourceType: record.entrySourceType,
          approvalStatus: record.approvalStatus,
          approvalBy: record.approvalBy,
          approvalAt: record.approvalAt,
          approvalReason: record.approvalReason,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          fileKeys: fuelExpenseFiles
            .filter((file) => file.fuelExpenseId === record.id)
            .map((file) => file.fileKey),
          ...(fuelEfficiency && { fuelEfficiency }),
        };
      });

      return {
        records: transformedRecords,
        totalRecords: Number(total),
        stats: {
          balances: {
            openingBalance: openingBalanceAmount,
            closingBalance: closingBalanceAmount,
            totalCredit: Number(summary.totalCredit),
            totalDebit: Number(summary.totalDebit),
            totalPetroCardExpense: Number(summary.totalPetroCardExpense),
            totalPetroCardDebitApproved: Number(summary.totalPetroCardDebitApproved),
            periodCredit: periodCredit,
            periodDebit: periodDebit,
          },
          projectedBalances: {
            openingBalance: projOpeningAmount,
            closingBalance: projClosingAmount,
            periodCredit: projPeriodCredit,
            periodDebit: projPeriodDebit,
          },
          approval: {
            pending: Number(summary.pendingCount),
            approved: Number(summary.approvedCount),
            rejected: Number(summary.rejectedCount),
            total: Number(summary.totalRecords),
          },
          ...(vehicleAverage && { vehicleAverage }),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getFuelExpenseHistory(fuelExpenseId: string) {
    try {
      const fuelExpense = await this.findOneOrFail({ where: { id: fuelExpenseId } });

      // Get the original fuel expense ID (could be this expense or an ancestor)
      const originalFuelExpenseId = fuelExpense.originalFuelExpenseId || fuelExpense.id;

      // Find all versions of this fuel expense (including the original)
      const [history] = await this.fuelExpenseRepository.findAll({
        where: [
          { id: originalFuelExpenseId }, // The original fuel expense itself
          { originalFuelExpenseId }, // All subsequent versions
        ],
        relations: [
          'user',
          'approvalByUser',
          'vehicle',
          'vehicle.vehicleVersions',
          'card',
          'createdByUser',
          'updatedByUser',
        ],
        order: { versionNumber: SortOrder.ASC },
      });

      // Fetch file keys for all fuel expense versions
      const fuelExpenseIds = history.map((record) => record.id);
      const allFiles = await this.fuelExpenseFilesService.findAll({
        where: { fuelExpenseId: In(fuelExpenseIds) },
      });

      // Group files by fuelExpenseId
      const filesByFuelExpenseId = allFiles.reduce((acc, file) => {
        if (!acc[file.fuelExpenseId]) {
          acc[file.fuelExpenseId] = [];
        }
        acc[file.fuelExpenseId].push(file.fileKey);
        return acc;
      }, {} as Record<string, string[]>);

      return {
        originalFuelExpenseId,
        currentVersion: fuelExpense.versionNumber,
        totalVersions: history.length,
        history: history.map((record) => ({
          id: record.id,
          versionNumber: record.versionNumber,
          vehicleId: record.vehicleId,
          cardId: record.cardId,
          fillDate: record.fillDate,
          odometerKm: record.odometerKm,
          fuelLiters: record.fuelLiters,
          fuelAmount: record.fuelAmount,
          pumpMeterReading: record.pumpMeterReading,
          paymentMode: record.paymentMode,
          transactionId: record.transactionId,
          description: record.description,
          transactionType: record.transactionType,
          expenseEntryType: record.expenseEntryType,
          entrySourceType: record.entrySourceType,
          approvalStatus: record.approvalStatus,
          approvalAt: record.approvalAt,
          approvalReason: record.approvalReason,
          isActive: record.isActive,
          editReason: record.editReason,
          parentFuelExpenseId: record.parentFuelExpenseId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          fileKeys: filesByFuelExpenseId[record.id] || [],
          user: {
            id: record.user?.id,
            firstName: record.user?.firstName,
            lastName: record.user?.lastName,
            email: record.user?.email,
            employeeId: record.user?.employeeId,
          },
          createdByUser: record.createdByUser
            ? {
                id: record.createdByUser.id,
                firstName: record.createdByUser.firstName,
                lastName: record.createdByUser.lastName,
                email: record.createdByUser.email,
                employeeId: record.createdByUser.employeeId,
              }
            : null,
          updatedByUser: record.updatedByUser
            ? {
                id: record.updatedByUser.id,
                firstName: record.updatedByUser.firstName,
                lastName: record.updatedByUser.lastName,
                email: record.updatedByUser.email,
                employeeId: record.updatedByUser.employeeId,
              }
            : null,
          approvalByUser: record.approvalByUser
            ? {
                id: record.approvalByUser.id,
                firstName: record.approvalByUser.firstName,
                lastName: record.approvalByUser.lastName,
                email: record.approvalByUser.email,
                employeeId: record.approvalByUser.employeeId,
              }
            : null,
          vehicle: record.vehicle
            ? (() => {
                const activeVersion = record.vehicle.vehicleVersions?.find((v) => v.isActive);
                return {
                  id: record.vehicle.id,
                  registrationNo: record.vehicle.registrationNo,
                  brand: activeVersion?.brand || null,
                  model: activeVersion?.model || null,
                  fuelType: activeVersion?.fuelType || null,
                  mileage: activeVersion?.mileage || null,
                  status: activeVersion?.status || null,
                };
              })()
            : null,
          card: record.card
            ? {
                id: record.card.id,
                cardNumber: record.card.cardNumber,
                cardType: record.card.cardType,
              }
            : null,
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  async delete(fuelExpenseId: string, deletedBy: string) {
    try {
      const fuelExpense = await this.findOneOrFail({
        where: { id: fuelExpenseId },
      });

      // Check if already deleted
      if (!fuelExpense.isActive || fuelExpense.deletedAt) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_ALREADY_DELETED);
      }

      // Check ownership - only creator can delete their own entry
      if (fuelExpense.createdBy !== deletedBy) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_OTHERS);
      }

      // Check approval status - only pending entries can be deleted
      if (fuelExpense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(
          FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
            '{status}',
            fuelExpense.approvalStatus,
          ),
        );
      }

      await this.fuelExpenseRepository.update(
        { id: fuelExpenseId },
        { isActive: false, updatedBy: deletedBy, deletedBy, deletedAt: new Date() },
      );
      return this.utilityService.getSuccessMessage(
        FuelExpenseEntityFields.FUEL_EXPENSE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }

  async bulkDeleteFuelExpenses(bulkDeleteDto: BulkDeleteFuelExpenseDto) {
    const { fuelExpenseIds, deletedBy } = bulkDeleteDto;
    const result = [];
    const errors = [];

    for (const fuelExpenseId of fuelExpenseIds) {
      try {
        const deletedFuelExpense = await this.validateAndDeleteFuelExpense(
          fuelExpenseId,
          deletedBy,
        );
        result.push(deletedFuelExpense);
      } catch (error) {
        errors.push({
          fuelExpenseId,
          error: error.message,
        });
      }
    }

    return {
      message: FUEL_EXPENSE_SUCCESS_MESSAGES.BULK_DELETE_SUCCESS.replace(
        '{length}',
        fuelExpenseIds.length.toString(),
      )
        .replace('{success}', result.length.toString())
        .replace('{error}', errors.length.toString()),
      result,
      errors,
    };
  }

  private async validateAndDeleteFuelExpense(fuelExpenseId: string, deletedBy: string) {
    // Find the fuel expense
    const fuelExpense = await this.fuelExpenseRepository.findOne({
      where: { id: fuelExpenseId },
    });

    // Check if fuel expense exists
    if (!fuelExpense) {
      throw new NotFoundException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_NOT_FOUND);
    }

    // Check if fuel expense is already deleted
    if (!fuelExpense.isActive || fuelExpense.deletedAt) {
      throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_ALREADY_DELETED);
    }

    // Check ownership - only creator can delete their own entry
    if (fuelExpense.createdBy !== deletedBy) {
      throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_OTHERS);
    }

    // Check approval status - only pending entries can be deleted
    if (fuelExpense.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
          '{status}',
          fuelExpense.approvalStatus,
        ),
      );
    }

    // Perform soft delete
    await this.fuelExpenseRepository.update(
      { id: fuelExpenseId },
      {
        isActive: false,
        updatedBy: deletedBy,
        deletedBy,
        deletedAt: new Date(),
      },
    );

    return {
      fuelExpenseId,
      message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_DELETED,
      previousStatus: fuelExpense.approvalStatus,
    };
  }

  async handleSingleFuelExpenseApproval(
    fuelExpenseId: string,
    approvalDto: FuelExpenseApprovalDto,
    approvalBy: string,
    entrySourceType: EntrySourceType,
  ) {
    try {
      const { approvalStatus, approvalReason } = approvalDto;

      return await this.dataSource.transaction(async (entityManager) => {
        const fuelExpense = await this.findOneOrFail(
          { where: { id: fuelExpenseId, isActive: true }, relations: ['user', 'vehicle'] },
          entityManager,
        );

        // Validate approval status transition
        await this.validateAndUpdateFuelExpenseApproval(
          fuelExpense,
          approvalStatus as ApprovalStatus,
          approvalBy,
          approvalReason,
          entrySourceType,
        );

        // Calculate vehicle average after approval
        const vehicleAverage = await this.calculateVehicleAverage(
          fuelExpense.vehicleId,
          entityManager,
        );

        // Send approval notification (email + WhatsApp)
        this.sendFuelExpenseApprovalNotification(
          fuelExpense,
          approvalBy,
          approvalStatus,
          approvalReason,
        );

        return {
          message:
            approvalStatus === ApprovalStatus.APPROVED
              ? FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_APPROVED
              : FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_REJECTED,
          fuelExpenseId,
          approvalStatus,
          vehicleAverage,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async handleBulkFuelExpenseApproval({
    approvals,
    approvalBy,
    entrySourceType,
  }: FuelExpenseBulkApprovalDto & { entrySourceType: EntrySourceType }) {
    try {
      const result = [];
      const errors = [];

      for (const approval of approvals) {
        try {
          await this.handleSingleFuelExpenseApproval(
            approval.fuelExpenseId,
            approval,
            approvalBy,
            entrySourceType,
          );
          result.push({
            fuelExpenseId: approval.fuelExpenseId,
            approvalStatus: approval.approvalStatus,
          });
        } catch (error) {
          errors.push({
            fuelExpenseId: approval.fuelExpenseId,
            error: error.message || error,
          });
        }
      }

      return {
        message: FUEL_EXPENSE_SUCCESS_MESSAGES.BULK_APPROVAL_SUCCESS.replace(
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

  private async validateAndUpdateFuelExpenseApproval(
    { approvalStatus: currentApprovalStatus, id: fuelExpenseId }: FuelExpenseEntity,
    approvalStatus: ApprovalStatus,
    approvalBy: string,
    approvalReason: string,
    entrySourceType: EntrySourceType,
  ) {
    try {
      switch (currentApprovalStatus) {
        case ApprovalStatus.PENDING:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED: {
              const fuelExpense = await this.findOneOrFail({ where: { id: fuelExpenseId } });
              if (approvalBy === fuelExpense.createdBy) {
                throw new BadRequestException(
                  FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR,
                );
              }
              await this.fuelExpenseRepository.update(
                { id: fuelExpenseId },
                {
                  approvalStatus,
                  approvalBy,
                  approvalAt: new Date(),
                  approvalReason,
                  entrySourceType,
                  updatedBy: approvalBy,
                },
              );
              break;
            }
            case ApprovalStatus.REJECTED: {
              const fuelExpense = await this.findOneOrFail({ where: { id: fuelExpenseId } });
              if (approvalBy === fuelExpense.createdBy) {
                throw new BadRequestException(
                  FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                );
              }
              await this.fuelExpenseRepository.update(
                { id: fuelExpenseId },
                {
                  approvalStatus,
                  approvalBy,
                  approvalAt: new Date(),
                  approvalReason,
                  entrySourceType,
                  updatedBy: approvalBy,
                },
              );
              break;
            }
            case ApprovalStatus.CANCELLED:
              await this.fuelExpenseRepository.update(
                { id: fuelExpenseId },
                {
                  approvalStatus,
                  approvalBy,
                  approvalAt: new Date(),
                  approvalReason,
                  entrySourceType,
                  updatedBy: approvalBy,
                },
              );
              break;
          }
          break;
        case ApprovalStatus.APPROVED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.REJECTED:
              await this.dataSource.transaction(async (entityManager) => {
                const fuelExpense = await this.findOneOrFail({ where: { id: fuelExpenseId } });
                await this.fuelExpenseRepository.update(
                  { id: fuelExpenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === fuelExpense.createdBy) {
                  throw new BadRequestException(
                    FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                  );
                }
                const originalFuelExpenseId = fuelExpense.originalFuelExpenseId || fuelExpenseId;
                const parentFuelExpenseId = fuelExpenseId;
                const versionNumber = fuelExpense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...fuelExpenseData } = fuelExpense;

                await this.fuelExpenseRepository.create(
                  {
                    ...fuelExpenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalFuelExpenseId,
                    parentFuelExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
          }
          break;
        case ApprovalStatus.REJECTED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              await this.dataSource.transaction(async (entityManager) => {
                const fuelExpense = await this.findOneOrFail({ where: { id: fuelExpenseId } });
                await this.fuelExpenseRepository.update(
                  { id: fuelExpenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === fuelExpense.createdBy) {
                  throw new BadRequestException(
                    FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                  );
                }
                const originalFuelExpenseId = fuelExpense.originalFuelExpenseId || fuelExpenseId;
                const parentFuelExpenseId = fuelExpenseId;
                const versionNumber = fuelExpense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...fuelExpenseData } = fuelExpense;

                await this.fuelExpenseRepository.create(
                  {
                    ...fuelExpenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalFuelExpenseId,
                    parentFuelExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.REJECTED:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
          }
          break;
        case ApprovalStatus.CANCELLED:
          switch (approvalStatus) {
            case ApprovalStatus.PENDING ||
              ApprovalStatus.APPROVED ||
              ApprovalStatus.REJECTED ||
              ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
          }
          break;
      }
    } catch (error) {
      throw error;
    }
  }

  async calculateVehicleAverage(
    vehicleId: string,
    entityManager?: EntityManager,
  ): Promise<{ average: number | null; averageKmPerLiter: number | null; message?: string }> {
    try {
      // Get all approved fuel expenses for this vehicle, ordered by fill date and odometer
      const [fuelExpenses] = await this.fuelExpenseRepository.findAll(
        {
          where: {
            vehicleId,
            approvalStatus: ApprovalStatus.APPROVED,
            isActive: true,
          },
          order: {
            fillDate: SortOrder.ASC,
            odometerKm: SortOrder.ASC,
          },
          relations: [],
        },
        entityManager,
      );

      if (fuelExpenses.length < 2) {
        return {
          average: null,
          averageKmPerLiter: null,
        };
      }

      let totalDistance = 0;
      let totalFuel = 0;

      for (let i = 1; i < fuelExpenses.length; i++) {
        const previous = fuelExpenses[i - 1];
        const current = fuelExpenses[i];

        const distance = Number(current.odometerKm) - Number(previous.odometerKm);
        const fuel = Number(current.fuelLiters);

        if (distance > 0 && fuel > 0) {
          totalDistance += distance;
          totalFuel += fuel;
        }
      }

      if (totalFuel > 0) {
        const average = Number((totalDistance / totalFuel).toFixed(2));
        return { average, averageKmPerLiter: average };
      }

      return {
        average: null,
        averageKmPerLiter: null,
      };
    } catch (error) {
      throw error;
    }
  }

  private async validateFillDate(fillDate: Date, timezone?: string) {
    // Use timezone-aware date comparison for future date check
    const fillDateStr = this.dateTimeService.toDateString(new Date(fillDate));
    if (this.dateTimeService.isFutureDate(fillDateStr, timezone)) {
      throw new BadRequestException(FUEL_EXPENSE_ERRORS.INVALID_FILL_DATE);
    }

    const dateValidationSetting = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.FUEL_EXPENSE,
        key: CONFIGURATION_KEYS.FUEL_EXPENSE_DATE_VALIDATION,
      },
    });

    const {
      value: { fuelExpenseCycleInDays },
    } = await this.configSettingService.findOneOrFail({
      where: { configId: dateValidationSetting.id, isActive: true },
    });

    const allowedDays = Number(fuelExpenseCycleInDays);

    // Use timezone-aware comparison for "too old" check
    const daysSinceFillDate = this.dateTimeService.getDaysSince(fillDateStr, timezone);
    if (daysSinceFillDate > allowedDays) {
      throw new BadRequestException(
        FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_DATE_TOO_OLD.replace('{days}', allowedDays.toString()),
      );
    }
  }

  private async validatePaymentMode(paymentMode: string) {
    const paymentModeSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.FUEL_EXPENSE, key: CONFIGURATION_KEYS.PAYMENT_MODES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: paymentModeSetting.id, isActive: true },
    });

    const isValidPaymentMode = configSetting.value.some((item: any) => item.name === paymentMode);

    if (!isValidPaymentMode) {
      const availablePaymentModes = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        FUEL_EXPENSE_ERRORS.PAYMENT_MODE_NOT_FOUND.replace(
          '{paymentModes}',
          availablePaymentModes.join(', '),
        ),
      );
    }
  }

  private async validateVehicleAssignment(vehicleId: string, userId: string): Promise<void> {
    const assignment = await this.vehicleVersionsService.findOne({
      where: {
        vehicleMasterId: vehicleId,
        assignedTo: userId,
        isActive: true,
        status: VehicleStatus.ASSIGNED,
      },
    });
    if (!assignment) {
      throw new BadRequestException(FUEL_EXPENSE_ERRORS.VEHICLE_NOT_ASSIGNED_TO_USER);
    }
  }

  private async validateOdometerReading(
    vehicleId: string,
    odometerKm: number,
    fillDate: Date,
    excludeFuelExpenseId?: string,
  ) {
    try {
      const baseWhere: any = {
        vehicleId,
        approvalStatus: In([ApprovalStatus.APPROVED, ApprovalStatus.PENDING]),
        isActive: true,
      };

      if (excludeFuelExpenseId) {
        baseWhere.id = Not(excludeFuelExpenseId) as any;
      }

      // Record just BEFORE this entry in chronological order (fillDate < new, or same date with lower odometer)
      const beforeRecord = await this.fuelExpenseRepository.findOne({
        where: [
          { ...baseWhere, fillDate: LessThan(fillDate) },
          { ...baseWhere, fillDate: Equal(fillDate), odometerKm: LessThan(odometerKm) },
        ],
        order: { fillDate: 'DESC', odometerKm: 'DESC' },
      } as any);

      // Record just AFTER this entry in chronological order (fillDate > new, or same date with higher odometer)
      const afterRecord = await this.fuelExpenseRepository.findOne({
        where: [
          { ...baseWhere, fillDate: MoreThan(fillDate) },
          { ...baseWhere, fillDate: Equal(fillDate), odometerKm: MoreThan(odometerKm) },
        ],
        order: { fillDate: 'ASC', odometerKm: 'ASC' },
      } as any);

      if (beforeRecord && odometerKm < Number(beforeRecord.odometerKm)) {
        throw new BadRequestException(
          `Odometer reading must be ≥ ${Number(beforeRecord.odometerKm)} km (recorded on ${new Date(
            beforeRecord.fillDate,
          ).toLocaleDateString('en-GB')})`,
        );
      }

      if (afterRecord && odometerKm > Number(afterRecord.odometerKm)) {
        throw new BadRequestException(
          `Odometer reading must be ≤ ${Number(afterRecord.odometerKm)} km (recorded on ${new Date(
            afterRecord.fillDate,
          ).toLocaleDateString('en-GB')})`,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  private async sendFuelExpenseApprovalNotification(
    fuelExpense: FuelExpenseEntity,
    approvalById: string,
    approvalStatus: string,
    approvalReason?: string,
  ) {
    try {
      const approver = await this.userService.findOne({ id: approvalById });
      const employee = fuelExpense.user;

      if (!employee) return;

      const isApproved = approvalStatus === ApprovalStatus.APPROVED;

      // Fetch vehicle with active version to get fuelType
      const vehicleData = fuelExpense.vehicleId
        ? await this.vehicleMastersService.findById(fuelExpense.vehicleId)
        : null;
      const vehicleNo = vehicleData?.registrationNo || FUEL_EXPENSE_EMAIL_CONSTANTS.NOT_APPLICABLE;

      // Determine fuel type class for styling (fuelType is on vehicle version)
      const fuelType = vehicleData?.fuelType || FUEL_EXPENSE_EMAIL_CONSTANTS.NOT_APPLICABLE;
      let fuelTypeClass = FUEL_EXPENSE_EMAIL_CONSTANTS.FUEL_TYPE_PETROL;
      if (fuelType.toLowerCase().includes('diesel'))
        fuelTypeClass = FUEL_EXPENSE_EMAIL_CONSTANTS.FUEL_TYPE_DIESEL;
      else if (fuelType.toLowerCase().includes('cng'))
        fuelTypeClass = FUEL_EXPENSE_EMAIL_CONSTANTS.FUEL_TYPE_CNG;
      else if (fuelType.toLowerCase().includes('electric'))
        fuelTypeClass = FUEL_EXPENSE_EMAIL_CONSTANTS.FUEL_TYPE_ELECTRIC;

      const pricePerLiter =
        Number(fuelExpense.fuelLiters) > 0
          ? (Number(fuelExpense.fuelAmount) / Number(fuelExpense.fuelLiters)).toFixed(2)
          : '0';

      const approverName = approver
        ? `${approver.firstName} ${approver.lastName}`
        : FUEL_EXPENSE_EMAIL_CONSTANTS.SYSTEM_USER;
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const amount = `₹${Number(fuelExpense.fuelAmount).toLocaleString('en-IN')}`;

      // Send Email notification
      if (employee.email) {
        const subjectKey = isApproved
          ? EMAIL_SUBJECT.FUEL_EXPENSE_APPROVED
          : EMAIL_SUBJECT.FUEL_EXPENSE_REJECTED;

        await this.emailService.sendMail({
          receiverEmails: employee.email,
          subject: subjectKey.replace('{vehicleNo}', vehicleNo),
          template: EMAIL_TEMPLATE.FUEL_EXPENSE_APPROVAL,
          emailData: {
            employeeName,
            isApproved,
            expenseId: fuelExpense.id.substring(0, 8).toUpperCase(),
            amount,
            fuelLiters: Number(fuelExpense.fuelLiters).toFixed(2),
            vehicleNumber: vehicleNo,
            fuelType,
            fuelTypeClass,
            fuelDate: this.formatDateForEmail(fuelExpense.fillDate),
            odometerReading: Number(fuelExpense.odometerKm).toLocaleString('en-IN'),
            pricePerLiter: `₹${pricePerLiter}`,
            approverName,
            approvalDate: this.formatDateForEmail(new Date()),
            remarks: approvalReason,
            portalUrl: `${Environments.FE_BASE_URL}${EMAIL_REDIRECT_ROUTES.FUEL_EXPENSES}`,
          },
        });
      }

      // Send WhatsApp notification (if user has opted in)
      const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
      if (employee.whatsappOptIn && whatsappNumber) {
        await this.whatsAppService.sendFuelExpenseApproval(
          whatsappNumber,
          {
            employeeName,
            amount,
            vehicleNumber: vehicleNo,
            approverName,
            remarks: approvalReason,
            isApproved,
          },
          {
            referenceId: fuelExpense.id,
            recipientId: employee.id,
          },
        );
      }
    } catch (error) {
      Logger.error('Failed to send fuel expense approval notification:', error);
    }
  }

  private formatDateForEmail(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
