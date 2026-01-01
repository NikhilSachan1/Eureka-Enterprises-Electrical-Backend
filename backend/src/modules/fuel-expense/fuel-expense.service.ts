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
import { Roles } from '../roles/constants/role.constants';
import {
  FUEL_EXPENSE_ERRORS,
  FUEL_EXPENSE_SUCCESS_MESSAGES,
  ApprovalStatus,
  DEFAULT_FUEL_EXPENSE,
  TransactionType,
  ExpenseEntryType,
  FuelExpenseEntityFields,
} from './constants/fuel-expense.constants';
import { FuelExpenseEntity } from './entities/fuel-expense.entity';
import { DataSource, EntityManager, FindOneOptions, In, Not } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { FuelExpenseFilesService } from '../fuel-expense-files/fuel-expense-files.service';
import { VehicleMastersService } from '../vehicle-masters/vehicle-masters.service';
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
  buildFuelExpenseSummaryQuery,
} from './queries/fuel-expense.queries';

@Injectable()
export class FuelExpenseService {
  constructor(
    private readonly fuelExpenseRepository: FuelExpenseRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fuelExpenseFilesService: FuelExpenseFilesService,
    private readonly vehicleMastersService: VehicleMastersService,
    @Inject(forwardRef(() => CardsService))
    private readonly cardsService: CardsService,
    private readonly userService: UserService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
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
        cardId,
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

      await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      if (cardId) {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      // Validate user exists
      await this.userService.findOneOrFail({ where: { id: userId } });

      // Validate odometer reading is greater than previous reading
      await this.validateOdometerReading(vehicleId, odometerKm);

      return await this.dataSource.transaction(async (entityManager) => {
        // Create fuel expense record
        const fuelExpense = await this.fuelExpenseRepository.create(
          {
            ...createFuelExpenseDto,
            approvalStatus: ApprovalStatus.PENDING,
            isActive: true,
            versionNumber: 1,
            createdBy,
            transactionType,
            expenseEntryType,
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

        return { message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_CREATED };
      });
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
        cardId,
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

      await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      if (cardId) {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      // Validate user exists
      await this.userService.findOneOrFail({ where: { id: userId } });

      // Validate odometer reading is greater than previous reading
      await this.validateOdometerReading(vehicleId, odometerKm);

      return await this.dataSource.transaction(async (entityManager) => {
        // Create fuel expense record as approved
        const fuelExpense = await this.fuelExpenseRepository.create(
          {
            ...createFuelExpenseDto,
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

        return { message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_FORCE_CREATED };
      });
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
      await this.userService.findOneOrFail({ where: { id: userId } });

      return await this.dataSource.transaction(async (entityManager) => {
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

        return { message: FUEL_EXPENSE_SUCCESS_MESSAGES.FUEL_EXPENSE_CREDIT_SETTLED };
      });
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

      const { vehicleId, cardId, fillDate, odometerKm, paymentMode } = editFuelExpenseDto;

      // Validate fill date
      await this.validateFillDate(fillDate, timezone);

      // Validate payment mode
      await this.validatePaymentMode(paymentMode);

      // Validate vehicle exists
      await this.vehicleMastersService.findOneOrFail({ where: { id: vehicleId } });

      // Validate card exists if provided
      if (cardId) {
        await this.cardsService.findOneOrFail({ where: { id: cardId } });
      }

      // Validate odometer reading
      await this.validateOdometerReading(vehicleId, odometerKm, id);

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

        // Calculate and return vehicle average
        const vehicleAverage = await this.calculateVehicleAverage(vehicleId, entityManager);

        return {
          ...newFuelExpense,
          vehicleAverage,
        };
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
  ): Promise<FuelExpenseListResponseDto> {
    try {
      const { ...filters } = fuelExpenseQueryDto;

      // Build all queries using the query builder functions
      const { query, countQuery, params, countParams } = buildFuelExpenseListQuery(filters);
      const { openingBalanceQuery, openingBalanceParams, periodTotalsQuery, periodParams } =
        buildFuelExpenseBalanceQuery(filters);
      const { summaryQuery, params: summaryParams } = buildFuelExpenseSummaryQuery(filters);

      // Execute all queries in parallel for better performance
      const [records, [{ total }], openingBalanceResult, periodTotalsResult, [summaryResult]] =
        await Promise.all([
          this.fuelExpenseRepository.executeRawQuery(query, params),
          this.fuelExpenseRepository.executeRawQuery(countQuery, countParams),
          this.fuelExpenseRepository.executeRawQuery(openingBalanceQuery, openingBalanceParams),
          this.fuelExpenseRepository.executeRawQuery(periodTotalsQuery, periodParams),
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

      // Calculate vehicle average if a specific vehicle is filtered
      let vehicleAverage = null;
      if (filters.vehicleId) {
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
        // Calculate fuel efficiency if we have previous odometer reading
        let fuelEfficiency = null;
        if (record.previousOdometerKm && Number(record.previousOdometerKm) > 0) {
          const distanceTraveled = Number(record.odometerKm) - Number(record.previousOdometerKm);
          const fuelLiters = Number(record.fuelLiters);

          if (distanceTraveled > 0 && fuelLiters > 0) {
            fuelEfficiency = {
              distanceTraveled: distanceTraveled,
              kmPerLiter: Number((distanceTraveled / fuelLiters).toFixed(2)),
              previousOdometerKm: Number(record.previousOdometerKm),
            };
          }
        }

        return {
          id: record.id,
          userId: record.userId,
          user: {
            id: record.userId,
            firstName: record.firstName,
            lastName: record.lastName,
            email: record.email,
            employeeId: record.employeeId,
          },
          vehicle: {
            id: record.vehicleId,
            registrationNumber: record.registrationNumber,
            vehicleType: record.vehicleType,
            vehicleModel: record.vehicleModel,
          },
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
            totalCreditCardExpense: Number(summary.totalCreditCardExpense),
            periodCredit: periodCredit,
            periodDebit: periodDebit,
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

      // Find all versions of this fuel expense
      const [history] = await this.fuelExpenseRepository.findAll({
        where: [
          { originalFuelExpenseId }, // All subsequent versions
        ],
        relations: ['user', 'approvedByUser', 'vehicle', 'card'],
        order: { versionNumber: SortOrder.ASC },
      });

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
          approvalStatus: record.approvalStatus,
          isActive: record.isActive,
          editReason: record.editReason,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          createdBy: record.createdBy,
          updatedBy: record.updatedBy,
          user: {
            id: record.user?.id,
            firstName: record.user?.firstName,
            lastName: record.user?.lastName,
            email: record.user?.email,
            employeeId: record.user?.employeeId,
          },
          approvalByUser: record.approvalByUser
            ? {
                id: record.approvalByUser.id,
                firstName: record.approvalByUser.firstName,
                lastName: record.approvalByUser.lastName,
                email: record.approvalByUser.email,
                employeeId: record.approvalByUser.employeeId,
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
      await this.findOneOrFail({
        where: { id: fuelExpenseId, isActive: true },
      });

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
    const { fuelExpenseIds, deletedBy, userRole } = bulkDeleteDto;
    const result = [];
    const errors = [];

    // Check if user is admin or HR (can delete anyone's fuel expense)
    const isAdminOrHR = userRole === Roles.ADMIN || userRole === Roles.HR;

    for (const fuelExpenseId of fuelExpenseIds) {
      try {
        const deletedFuelExpense = await this.validateAndDeleteFuelExpense(
          fuelExpenseId,
          deletedBy,
          isAdminOrHR,
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

  private async validateAndDeleteFuelExpense(
    fuelExpenseId: string,
    deletedBy: string,
    isAdminOrHR: boolean,
  ) {
    // Find the fuel expense
    const fuelExpense = await this.fuelExpenseRepository.findOne({
      where: { id: fuelExpenseId },
    });

    // Check if fuel expense exists
    if (!fuelExpense) {
      throw new NotFoundException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_NOT_FOUND);
    }

    // Check if fuel expense is already deleted
    if (!fuelExpense.isActive) {
      throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_ALREADY_DELETED);
    }

    // If not admin/HR, apply additional validations
    if (!isAdminOrHR) {
      // Check if user owns the fuel expense
      if (fuelExpense.userId !== deletedBy) {
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_OTHERS);
      }

      // Check if fuel expense is pending (only pending can be deleted by non-admin)
      if (fuelExpense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(
          FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
            '{status}',
            fuelExpense.approvalStatus,
          ),
        );
      }
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
          { where: { id: fuelExpenseId, isActive: true }, relations: ['user'] },
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
                    FUEL_EXPENSE_ERRORS.FUEL_EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR,
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
  ): Promise<{ average: number; averageKmPerLiter: number }> {
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
        throw new BadRequestException(FUEL_EXPENSE_ERRORS.INSUFFICIENT_DATA_TO_CALCULATE_AVERAGE);
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

      throw new BadRequestException(FUEL_EXPENSE_ERRORS.INSUFFICIENT_DATA_TO_CALCULATE_AVERAGE);
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

  private async validateOdometerReading(
    vehicleId: string,
    odometerKm: number,
    excludeFuelExpenseId?: string,
  ) {
    try {
      // Get the latest fuel expense for this vehicle
      const whereCondition: any = {
        vehicleId,
        approvalStatus: ApprovalStatus.APPROVED,
        isActive: true,
      };

      if (excludeFuelExpenseId) {
        whereCondition.id = Not(excludeFuelExpenseId) as any;
      }

      const previousFuelExpense = await this.fuelExpenseRepository.findOne({
        where: whereCondition,
        order: { fillDate: 'DESC', odometerKm: 'DESC' },
      } as any);

      // If there's a previous record, validate odometer reading
      if (previousFuelExpense) {
        const previousOdometer = Number(previousFuelExpense.odometerKm);
        if (odometerKm < previousOdometer) {
          throw new BadRequestException(FUEL_EXPENSE_ERRORS.INVALID_ODOMETER_READING);
        }
      }
    } catch (error) {
      throw error;
    }
  }
}
