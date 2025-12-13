import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseTrackerRepository } from './expense-tracker.repository';
import {
  CreateCreditExpenseDto,
  CreateDebitExpenseDto,
  EditExpenseDto,
  ExpenseBulkApprovalDto,
  ExpenseApprovalDto,
  ExpenseListResponseDto,
  ExpenseQueryDto,
  ForceExpenseDto,
  BulkDeleteExpenseDto,
} from './dto';
import { Roles } from '../roles/constants/role.constants';
import {
  CONFIGURATION_MODULES,
  CONFIGURATION_KEYS,
  EntrySourceType,
} from 'src/utils/master-constants/master-constants';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  EXPENSE_TRACKER_ERRORS,
  ExpenseEntryType,
  TransactionType,
  ApprovalStatus,
  DEFAULT_EXPENSE,
  ExpenseTrackerEntityFields,
  EXPENSE_TRACKER_SUCCESS_MESSAGES,
} from './constants/expense-tracker.constants';
import { ExpenseTrackerEntity } from './entities/expense-tracker.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere, In } from 'typeorm';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  buildExpenseListQuery,
  buildExpenseBalanceQuery,
  buildExpenseSummaryQuery,
} from './queries/expense-tracker.queries';
import { ExpenseFilesService } from '../expense-files/expense-files.service';

@Injectable()
export class ExpenseTrackerService {
  constructor(
    private readonly expenseTrackerRepository: ExpenseTrackerRepository,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly expenseFilesService: ExpenseFilesService,
  ) {}

  async createDebitExpense(
    createExpenseDto: CreateDebitExpenseDto & {
      userId: string;
      sourceType: EntrySourceType;
      fileKeys: string[];
    },
  ) {
    try {
      const { category, paymentMode, amount, expenseDate, userId, sourceType, fileKeys } =
        createExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);
      await this.validateExpenseDate(expenseDate);

      return await this.dataSource.transaction(async (entityManager) => {
        const expense = await this.expenseTrackerRepository.create(
          {
            ...createExpenseDto,
            isActive: true,
            amount: Number(amount),
            approvalStatus: ApprovalStatus.PENDING,
            transactionType: TransactionType.DEBIT,
            expenseEntryType: ExpenseEntryType.SELF,
            entrySourceType: sourceType,
            createdBy: userId,
          },
          entityManager,
        );

        if (fileKeys) {
          await this.expenseFilesService.create(
            {
              expenseId: expense.id,
              fileKeys,
              createdBy: userId,
            },
            entityManager,
          );
        }

        return expense;
      });
    } catch (error) {
      throw error;
    }
  }

  private async validateExpenseCategory(category: string) {
    const expenseCategorySetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.EXPENSE, key: CONFIGURATION_KEYS.EXPENSE_CATEGORIES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: expenseCategorySetting.id, isActive: true },
    });

    const isValidExpenseCategory = configSetting.value.some((item: any) => item.name === category);

    if (!isValidExpenseCategory) {
      const availableExpenseCategories = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.EXPENSE_CATEGORY_NOT_FOUND.replace(
          '{expenseCategories}',
          availableExpenseCategories.join(', '),
        ),
      );
    }
  }

  private async validatePaymentMode(paymentMode: string) {
    const paymentModeSetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.EXPENSE, key: CONFIGURATION_KEYS.PAYMENT_MODES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: paymentModeSetting.id, isActive: true },
    });

    const isValidPaymentMode = configSetting.value.some((item: any) => item.name === paymentMode);

    if (!isValidPaymentMode) {
      const availablePaymentModes = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.PAYMENT_MODE_NOT_FOUND.replace(
          '{paymentModes}',
          availablePaymentModes.join(', '),
        ),
      );
    }
  }

  private async validateExpenseDate(expenseDate: Date) {
    if (new Date(expenseDate) > new Date()) {
      throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
    }

    const dateValidationSetting = await this.configurationService.findOneOrFail({
      where: {
        module: CONFIGURATION_MODULES.EXPENSE,
        key: CONFIGURATION_KEYS.EXPENSE_DATE_VALIDATION,
      },
    });

    const {
      value: { expenseCycleInDays },
    } = await this.configSettingService.findOneOrFail({
      where: { configId: dateValidationSetting.id, isActive: true },
    });

    const allowedDays = Number(expenseCycleInDays);
    const currentDate = new Date();
    const allowedDate = new Date(currentDate.getTime() - allowedDays * 24 * 60 * 60 * 1000);

    if (expenseDate < allowedDate) {
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.EXPENSE_DATE_TOO_OLD.replace('{days}', allowedDays.toString()),
      );
    }
  }

  async forceExpense(
    forceExpenseDto: ForceExpenseDto & {
      createdBy: string;
      sourceType: EntrySourceType;
      fileKeys: string[];
    },
  ) {
    try {
      const { category, paymentMode, amount, createdBy, sourceType, expenseDate, fileKeys } =
        forceExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);
      if (new Date(expenseDate) > new Date()) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
      }

      return await this.dataSource.transaction(async (entityManager) => {
        const expense = await this.expenseTrackerRepository.create({
          ...forceExpenseDto,
          isActive: true,
          amount: Number(amount),
          approvalStatus: ApprovalStatus.APPROVED,
          approvalAt: new Date(),
          approvalBy: createdBy,
          approvalReason: DEFAULT_EXPENSE.FORCE_APPROVAL_REASON,
          transactionType: TransactionType.DEBIT,
          expenseEntryType: ExpenseEntryType.FORCED,
          entrySourceType: sourceType,
          createdBy,
        });

        if (fileKeys) {
          await this.expenseFilesService.create(
            {
              expenseId: expense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }
        return expense;
      });
    } catch (error) {
      throw error;
    }
  }

  async createCreditExpense(
    createExpenseDto: CreateCreditExpenseDto & {
      createdBy: string;
      sourceType: EntrySourceType;
      fileKeys: string[];
    },
  ) {
    try {
      const { category, paymentMode, amount, expenseDate, createdBy, sourceType, fileKeys } =
        createExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      if (new Date(expenseDate) > new Date()) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
      }

      return await this.dataSource.transaction(async (entityManager) => {
        const expense = await this.expenseTrackerRepository.create(
          {
            ...createExpenseDto,
            isActive: true,
            amount: Number(amount),
            approvalStatus: ApprovalStatus.APPROVED,
            approvalAt: new Date(),
            approvalBy: createdBy,
            approvalReason: DEFAULT_EXPENSE.CREDIT_APPROVAL_REASON,
            transactionType: TransactionType.CREDIT,
            expenseEntryType: ExpenseEntryType.SELF,
            entrySourceType: sourceType,
            createdBy,
          },
          entityManager,
        );

        if (fileKeys) {
          await this.expenseFilesService.create(
            {
              expenseId: expense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }

        return expense;
      });
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOneOptions<ExpenseTrackerEntity>): Promise<ExpenseTrackerEntity> {
    try {
      return await this.expenseTrackerRepository.findOne(options);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(
    options: FindOneOptions<ExpenseTrackerEntity>,
    entityManager?: EntityManager,
  ): Promise<ExpenseTrackerEntity> {
    try {
      const expense = await this.expenseTrackerRepository.findOne(options, entityManager);

      if (!expense) {
        throw new NotFoundException(EXPENSE_TRACKER_ERRORS.NOT_FOUND);
      }

      return expense;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<ExpenseTrackerEntity>,
    updateData: Partial<ExpenseTrackerEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.expenseTrackerRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        ExpenseTrackerEntityFields.ID,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async editExpense(
    editExpenseDto: EditExpenseDto & {
      id: string;
      updatedBy: string;
      entrySourceType: EntrySourceType;
      fileKeys: string[];
    },
  ) {
    try {
      const { id, updatedBy, entrySourceType, editReason, fileKeys } = editExpenseDto;
      const expense = await this.findOneOrFail({ where: { id, isActive: true } });

      if (expense.createdBy !== updatedBy) {
        throw new BadRequestException(
          EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_EDITED_BY_OTHER_USER,
        );
      }
      if (expense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_EDITED);
      }

      return await this.dataSource.transaction(async (entityManager) => {
        await this.expenseTrackerRepository.update(
          { id },
          { isActive: false, updatedBy },
          entityManager,
        );

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, ...editData } = editExpenseDto;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: __, ...expenseData } = expense;

        const originalExpenseId = expense.originalExpenseId || expense.id;
        const parentExpenseId = expense.id;
        const versionNumber = expense.versionNumber + 1;

        await this.expenseTrackerRepository.create(
          {
            ...expenseData,
            ...editData,
            isActive: true,
            updatedBy,
            entrySourceType,
            originalExpenseId,
            parentExpenseId,
            versionNumber,
            editReason: editReason || DEFAULT_EXPENSE.EDIT_REASON,
          },
          entityManager,
        );

        if (fileKeys) {
          await this.expenseFilesService.create(
            {
              expenseId: expense.id,
              fileKeys,
              createdBy: updatedBy,
            },
            entityManager,
          );
        }

        return this.utilityService.getSuccessMessage(
          ExpenseTrackerEntityFields.EXPENSE,
          DataSuccessOperationType.UPDATE,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async getExpenseRecords(expenseQueryDto: ExpenseQueryDto): Promise<ExpenseListResponseDto> {
    try {
      const { ...filters } = expenseQueryDto;

      // Build all queries
      const { query, countQuery, params, countParams } = buildExpenseListQuery(filters);
      const { openingBalanceQuery, openingBalanceParams, periodTotalsQuery, periodParams } =
        buildExpenseBalanceQuery(filters);
      const { summaryQuery, params: summaryParams } = buildExpenseSummaryQuery(filters);

      // Execute all queries in parallel
      const [records, [{ total }], openingBalanceResult, periodTotalsResult, [summaryResult]] =
        await Promise.all([
          this.expenseTrackerRepository.executeRawQuery(query, params),
          this.expenseTrackerRepository.executeRawQuery(countQuery, countParams),
          this.expenseTrackerRepository.executeRawQuery(openingBalanceQuery, openingBalanceParams),
          this.expenseTrackerRepository.executeRawQuery(periodTotalsQuery, periodParams),
          this.expenseTrackerRepository.executeRawQuery(summaryQuery, summaryParams),
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
        totalRecords: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      };

      const expenseFiles = await this.expenseFilesService.findAll({
        where: {
          expenseId: In(records.map((record: any) => record.id)),
        },
        select: ['id', 'fileKey', 'expenseId'],
      });

      // Transform records to include user information
      const transformedRecords = records.map((record: any) => ({
        id: record.id,
        userId: record.userId,
        category: record.category,
        description: record.description,
        amount: Number(record.amount),
        transactionId: record.transactionId,
        expenseDate: record.expenseDate,
        approvalStatus: record.approvalStatus,
        approvalBy: record.approvalBy,
        approvalAt: record.approvalAt,
        approvalReason: record.approvalReason,
        transactionType: record.transactionType,
        paymentMode: record.paymentMode,
        entrySourceType: record.entrySourceType,
        expenseEntryType: record.expenseEntryType,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        fileKeys: expenseFiles
          .filter((file) => file.expenseId === record.id)
          .map((file) => file.fileKey),
        user: {
          id: record.userId,
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          employeeId: record.employeeId,
        },
        approvalByUser: record.approvalBy
          ? {
              id: record.approvalBy,
              firstName: record.approvalByFirstName,
              lastName: record.approvalByLastName,
              email: record.approvalByEmail,
              employeeId: record.approvalByEmployeeId,
            }
          : null,
      }));

      return {
        records: transformedRecords,
        totalRecords: Number(total),
        stats: {
          balances: {
            openingBalance: openingBalanceAmount,
            closingBalance: closingBalanceAmount,
            totalCredit: Number(summary.totalCredit),
            totalDebit: Number(summary.totalDebit),
            periodCredit: periodCredit,
            periodDebit: periodDebit,
          },
          approval: {
            pending: Number(summary.pendingCount),
            approved: Number(summary.approvedCount),
            rejected: Number(summary.rejectedCount),
            total: Number(summary.totalRecords),
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getExpenseHistory(expenseId: string) {
    try {
      const expense = await this.findOneOrFail({ where: { id: expenseId } });

      // Get the original expense ID (could be this expense or an ancestor)
      const originalExpenseId = expense.originalExpenseId || expense.id;

      // Find all versions of this expense (including the original)
      const history = await this.expenseTrackerRepository.findAll({
        where: [
          { id: originalExpenseId }, // The original expense itself
          { originalExpenseId }, // All subsequent versions
        ],
        relations: ['user', 'approvalByUser'],
        order: { versionNumber: SortOrder.ASC },
      });

      return {
        originalExpenseId,
        currentVersion: expense.versionNumber,
        totalVersions: history.length,
        history: history.map((record) => ({
          id: record.id,
          versionNumber: record.versionNumber,
          amount: record.amount,
          category: record.category,
          description: record.description,
          expenseDate: record.expenseDate,
          transactionId: record.transactionId,
          transactionType: record.transactionType,
          paymentMode: record.paymentMode,
          entrySourceType: record.entrySourceType,
          expenseEntryType: record.expenseEntryType,
          approvalStatus: record.approvalStatus,
          approvalAt: record.approvalAt,
          approvalReason: record.approvalReason,
          isActive: record.isActive,
          editReason: record.editReason,
          parentExpenseId: record.parentExpenseId,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          createdBy: record.createdBy,
          updatedBy: record.updatedBy,
          user: record.user
            ? {
                id: record.user.id,
                firstName: record.user.firstName,
                lastName: record.user.lastName,
                email: record.user.email,
                employeeId: record.user.employeeId,
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
        })),
      };
    } catch (error) {
      throw error;
    }
  }

  async handleBulkExpenseApproval({
    approvals,
    approvalBy,
    entrySourceType,
  }: ExpenseBulkApprovalDto & { entrySourceType: EntrySourceType }) {
    try {
      const result = [];
      const errors = [];

      for (const approval of approvals) {
        try {
          const expense = await this.handleSingleExpenseApproval(
            approval.expenseId,
            approval,
            approvalBy,
            entrySourceType,
          );
          result.push(expense);
        } catch (error) {
          errors.push({
            expenseId: approval.expenseId,
            error: error.message,
          });
        }
      }
      return {
        message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_APPROVAL_PROCESSED.replace(
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

  async handleSingleExpenseApproval(
    expenseId: string,
    approvalDto: ExpenseApprovalDto,
    approvalBy: string,
    entrySourceType: EntrySourceType,
  ) {
    try {
      const { approvalStatus, approvalComment } = approvalDto;

      return await this.dataSource.transaction(async (entityManager) => {
        const expense = await this.findOneOrFail(
          {
            where: { id: expenseId },
            relations: ['user'],
          },
          entityManager,
        );

        await this.validateAndUpdateExpenseApproval(
          expense,
          approvalStatus as ApprovalStatus,
          approvalBy,
          approvalComment,
          entrySourceType,
        );

        return {
          message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_APPROVAL_SUCCESS.replace(
            '{status}',
            approvalStatus,
          ),
          expenseId,
          previousStatus: expense.approvalStatus,
          approvalStatus,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  private async validateAndUpdateExpenseApproval(
    { approvalStatus: currentApprovalStatus, id: expenseId }: ExpenseTrackerEntity,
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
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              await this.dataSource.transaction(async (entityManager) => {
                const expense = await this.findOneOrFail({ where: { id: expenseId } });
                await this.expenseTrackerRepository.update(
                  { id: expenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === expense.createdBy) {
                  throw new BadRequestException(
                    EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR,
                  );
                }
                const originalExpenseId = expense.originalExpenseId || expenseId;
                const parentExpenseId = expenseId;
                const versionNumber = expense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...expenseData } = expense;

                await this.expenseTrackerRepository.create(
                  {
                    ...expenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalExpenseId,
                    parentExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.REJECTED:
              await this.dataSource.transaction(async (entityManager) => {
                const expense = await this.findOneOrFail({ where: { id: expenseId } });
                await this.expenseTrackerRepository.update(
                  { id: expenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === expense.createdBy) {
                  throw new BadRequestException(
                    EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                  );
                }
                const originalExpenseId = expense.originalExpenseId || expenseId;
                const parentExpenseId = expenseId;
                const versionNumber = expense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...expenseData } = expense;

                await this.expenseTrackerRepository.create(
                  {
                    ...expenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalExpenseId,
                    parentExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.CANCELLED:
              await this.dataSource.transaction(async (entityManager) => {
                const expense = await this.findOneOrFail({ where: { id: expenseId } });
                await this.expenseTrackerRepository.update(
                  { id: expenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                const originalExpenseId = expense.originalExpenseId || expenseId;
                const parentExpenseId = expenseId;
                const versionNumber = expense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...expenseData } = expense;

                await this.expenseTrackerRepository.create(
                  {
                    ...expenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalExpenseId,
                    parentExpenseId,
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
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              throw new BadRequestException(
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.REJECTED:
              await this.dataSource.transaction(async (entityManager) => {
                const expense = await this.findOneOrFail({ where: { id: expenseId } });
                await this.expenseTrackerRepository.update(
                  { id: expenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === expense.createdBy) {
                  throw new BadRequestException(
                    EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                  );
                }
                const originalExpenseId = expense.originalExpenseId || expenseId;
                const parentExpenseId = expenseId;
                const versionNumber = expense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...expenseData } = expense;

                await this.expenseTrackerRepository.create(
                  {
                    ...expenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalExpenseId,
                    parentExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
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
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.APPROVED:
              await this.dataSource.transaction(async (entityManager) => {
                const expense = await this.findOneOrFail({ where: { id: expenseId } });
                await this.expenseTrackerRepository.update(
                  { id: expenseId },
                  {
                    isActive: false,
                    updatedBy: approvalBy,
                  },
                  entityManager,
                );
                if (approvalBy === expense.createdBy) {
                  throw new BadRequestException(
                    EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                  );
                }
                const originalExpenseId = expense.originalExpenseId || expenseId;
                const parentExpenseId = expenseId;
                const versionNumber = expense.versionNumber + 1;

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: __, ...expenseData } = expense;

                await this.expenseTrackerRepository.create(
                  {
                    ...expenseData,
                    isActive: true,
                    updatedBy: approvalBy,
                    approvalAt: new Date(),
                    approvalStatus,
                    approvalBy,
                    approvalReason,
                    entrySourceType,
                    originalExpenseId,
                    parentExpenseId,
                    versionNumber,
                  },
                  entityManager,
                );
              });
              break;
            case ApprovalStatus.REJECTED:
              throw new BadRequestException(
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
                  '{status}',
                  approvalStatus,
                ),
              );
            case ApprovalStatus.CANCELLED:
              throw new BadRequestException(
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
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
                EXPENSE_TRACKER_ERRORS.EXPENSE_STATUS_SWITCH_ERROR.replace(
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

  async deleteExpense(id: string, deletedBy: string) {
    try {
      await this.findOneOrFail({ where: { id } });
      await this.expenseTrackerRepository.update(
        { id },
        { isActive: false, updatedBy: deletedBy, deletedBy, deletedAt: new Date() },
      );
      return this.utilityService.getSuccessMessage(
        ExpenseTrackerEntityFields.EXPENSE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }

  async bulkDeleteExpenses(bulkDeleteDto: BulkDeleteExpenseDto) {
    const { expenseIds, deletedBy, userRole } = bulkDeleteDto;
    const result = [];
    const errors = [];

    // Check if user is admin or HR (can delete anyone's expense)
    const isAdminOrHR = userRole === Roles.ADMIN || userRole === Roles.HR;

    for (const expenseId of expenseIds) {
      try {
        const deletedExpense = await this.validateAndDeleteExpense(
          expenseId,
          deletedBy,
          isAdminOrHR,
        );
        result.push(deletedExpense);
      } catch (error) {
        errors.push({
          expenseId,
          error: error.message,
        });
      }
    }

    return {
      message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_DELETE_PROCESSED.replace(
        '{length}',
        expenseIds.length.toString(),
      )
        .replace('{success}', result.length.toString())
        .replace('{error}', errors.length.toString()),
      result,
      errors,
    };
  }

  private async validateAndDeleteExpense(
    expenseId: string,
    deletedBy: string,
    isAdminOrHR: boolean,
  ) {
    // Find the expense
    const expense = await this.expenseTrackerRepository.findOne({
      where: { id: expenseId },
    });

    // Check if expense exists
    if (!expense) {
      throw new NotFoundException(EXPENSE_TRACKER_ERRORS.NOT_FOUND);
    }

    // Check if expense is already deleted
    if (!expense.isActive) {
      throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_ALREADY_DELETED);
    }

    // If not admin/HR, apply additional validations
    if (!isAdminOrHR) {
      // Check if user owns the expense
      if (expense.userId !== deletedBy) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_OTHERS);
      }

      // Check if expense is pending (only pending expenses can be deleted by non-admin)
      if (expense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(
          EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
            '{status}',
            expense.approvalStatus,
          ),
        );
      }
    }

    // Perform soft delete
    await this.expenseTrackerRepository.update(
      { id: expenseId },
      {
        isActive: false,
        updatedBy: deletedBy,
        deletedBy,
        deletedAt: new Date(),
      },
    );

    return {
      expenseId,
      message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_DELETE_SUCCESS,
      previousStatus: expense.approvalStatus,
    };
  }
}

// TODO: Email notification to the user
