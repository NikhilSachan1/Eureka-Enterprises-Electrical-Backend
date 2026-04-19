import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExpenseTrackerRepository } from './expense-tracker.repository';
import {
  CreateCreditExpenseDto,
  CreateDebitExpenseDto,
  CreditBonusExpenseDto,
  EditExpenseDto,
  ExpenseBulkApprovalDto,
  ExpenseApprovalDto,
  ExpenseListResponseDto,
  ExpenseQueryDto,
  ForceExpenseDto,
  BulkDeleteExpenseDto,
} from './dto';
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
  EXPENSE_EMAIL_CONSTANTS,
  SYSTEM_EXPENSE_DEFAULTS,
} from './constants/expense-tracker.constants';
import { ExpenseTrackerEntity } from './entities/expense-tracker.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere, In } from 'typeorm';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  buildExpenseListQuery,
  buildExpenseBalanceQuery,
  buildProjectedBalanceQuery,
  buildExpenseSummaryQuery,
} from './queries/expense-tracker.queries';
import { ExpenseFilesService } from '../expense-files/expense-files.service';
import { DateTimeService } from 'src/utils/datetime';
import { EmailService } from '../common/email/email.service';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { UserService } from '../users/user.service';
import { Environments } from 'env-configs';
import {
  EMAIL_SUBJECT,
  EMAIL_TEMPLATE,
  EMAIL_REDIRECT_ROUTES,
} from '../common/email/constants/email.constants';

@Injectable()
export class ExpenseTrackerService {
  constructor(
    private readonly expenseTrackerRepository: ExpenseTrackerRepository,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly expenseFilesService: ExpenseFilesService,
    private readonly dateTimeService: DateTimeService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly userService: UserService,
  ) {}

  async createDebitExpense(
    createExpenseDto: CreateDebitExpenseDto & {
      userId: string;
      userRole?: string;
      sourceType: EntrySourceType;
      fileKeys: string[];
      timezone?: string;
    },
  ) {
    try {
      const {
        category,
        paymentMode,
        amount,
        expenseDate,
        userId,
        userRole,
        sourceType,
        fileKeys,
        timezone,
      } = createExpenseDto;
      await this.validateExpenseCategory(category, userRole);
      await this.validatePaymentMode(paymentMode);
      await this.validateExpenseDate(expenseDate, timezone);

      const employee = await this.userService.findOneOrFail({ where: { id: userId } });

      const result = await this.dataSource.transaction(async (entityManager) => {
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

        return { message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_CREATED, id: expense.id };
      });

      // Send WhatsApp notification to employee (non-blocking)
      try {
        const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
        if (employee.whatsappOptIn && whatsappNumber) {
          await this.whatsAppService.sendExpenseSubmitted(
            whatsappNumber,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              amount: `₹${Number(amount).toLocaleString('en-IN')}`,
              category,
            },
            { referenceId: result.id, recipientId: employee.id },
          );
        }
      } catch (err) {
        Logger.error('Failed to send expense submitted WhatsApp notification:', err);
      }

      return { message: result.message };
    } catch (error) {
      throw error;
    }
  }

  private async validateExpenseCategory(category: string, userRole?: string) {
    const expenseCategorySetting = await this.configurationService.findOneOrFail({
      where: { module: CONFIGURATION_MODULES.EXPENSE, key: CONFIGURATION_KEYS.EXPENSE_CATEGORIES },
    });

    const configSetting = await this.configSettingService.findOneOrFail({
      where: { configId: expenseCategorySetting.id, isActive: true },
    });

    const categoryConfig = configSetting.value.find((item: any) => item.name === category);

    if (!categoryConfig) {
      const availableExpenseCategories = configSetting.value.map((item: any) => item.name);
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.EXPENSE_CATEGORY_NOT_FOUND.replace(
          '{expenseCategories}',
          availableExpenseCategories.join(', '),
        ),
      );
    }

    // Check role restriction if category has allowedRoles
    if (
      userRole &&
      categoryConfig.allowedRoles &&
      categoryConfig.allowedRoles.length > 0 &&
      !categoryConfig.allowedRoles.includes(userRole)
    ) {
      throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CATEGORY_NOT_ALLOWED);
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

  private async validateExpenseDate(expenseDate: Date | string, timezone?: string) {
    // Use timezone-aware date comparison
    const expenseDateStr =
      typeof expenseDate === 'string'
        ? expenseDate.split('T')[0]
        : this.dateTimeService.toDateString(new Date(expenseDate));

    if (this.dateTimeService.isFutureDate(expenseDateStr, timezone)) {
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
    const daysSinceExpense = this.dateTimeService.getDaysSince(expenseDateStr, timezone);

    if (daysSinceExpense > allowedDays) {
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
      timezone?: string;
    },
  ) {
    try {
      const {
        category,
        paymentMode,
        amount,
        createdBy,
        sourceType,
        expenseDate,
        fileKeys,
        timezone,
      } = forceExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      // Use timezone-aware date comparison
      const expenseDateStr = this.dateTimeService.toDateString(new Date(expenseDate));
      if (this.dateTimeService.isFutureDate(expenseDateStr, timezone)) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
      }

      const { userId } = forceExpenseDto;
      const employee = await this.userService.findOneOrFail({ where: { id: userId } });
      const admin = await this.userService.findOne({ id: createdBy });

      const result = await this.dataSource.transaction(async (entityManager) => {
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
        return { message: EXPENSE_TRACKER_SUCCESS_MESSAGES.EXPENSE_FORCE_CREATED, id: expense.id };
      });

      // Send WhatsApp force-created notification to employee (non-blocking)
      try {
        const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
        if (employee.whatsappOptIn && whatsappNumber) {
          const adminName = admin
            ? `${admin.firstName} ${admin.lastName}`
            : EXPENSE_EMAIL_CONSTANTS.SYSTEM_USER;
          const formattedCategory = category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          await this.whatsAppService.sendExpenseForceCreated(
            whatsappNumber,
            {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              amount: `₹${Number(amount).toLocaleString('en-IN')}`,
              category: formattedCategory,
              createdByName: adminName,
            },
            { referenceId: result.id, recipientId: employee.id },
          );
        }
      } catch (err) {
        Logger.error('Failed to send force expense WhatsApp notification:', err);
      }

      return { message: result.message };
    } catch (error) {
      throw error;
    }
  }

  async creditBonusExpense(
    creditBonusDto: CreditBonusExpenseDto & {
      createdBy: string;
      sourceType: EntrySourceType;
      fileKeys: string[];
      timezone?: string;
    },
  ) {
    try {
      const {
        amount,
        expenseDate,
        createdBy,
        sourceType,
        fileKeys,
        timezone,
        siteId,
        description,
        category,
        paymentMode,
      } = creditBonusDto;

      // Validate category and payment mode
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      // Use timezone-aware date comparison
      const expenseDateStr = this.dateTimeService.toDateString(new Date(expenseDate));
      if (this.dateTimeService.isFutureDate(expenseDateStr, timezone)) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
      }

      return await this.dataSource.transaction(async (entityManager) => {
        const expense = await this.expenseTrackerRepository.create({
          ...creditBonusDto,
          category,
          description,
          paymentMode,
          siteId,
          isActive: true,
          amount: Number(amount),
          approvalStatus: ApprovalStatus.PENDING,
          transactionType: TransactionType.DEBIT,
          expenseEntryType: ExpenseEntryType.CREDIT_BONUS,
          entrySourceType: sourceType,
          createdBy,
        });

        if (fileKeys && fileKeys.length > 0) {
          await this.expenseFilesService.create(
            {
              expenseId: expense.id,
              fileKeys,
              createdBy,
            },
            entityManager,
          );
        }
        return { message: EXPENSE_TRACKER_SUCCESS_MESSAGES.CREDIT_BONUS_CREATED, data: expense };
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
      timezone?: string;
    },
  ) {
    try {
      const {
        category,
        paymentMode,
        amount,
        expenseDate,
        createdBy,
        sourceType,
        fileKeys,
        timezone,
      } = createExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      // Use timezone-aware date comparison
      const expenseDateStr = this.dateTimeService.toDateString(new Date(expenseDate));
      if (this.dateTimeService.isFutureDate(expenseDateStr, timezone)) {
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

        // Load user relation for notification
        const expenseWithUser = await this.expenseTrackerRepository.findOne(
          { where: { id: expense.id }, relations: ['user'] },
          entityManager,
        );
        if (expenseWithUser) {
          this.sendExpenseApprovalNotification(expenseWithUser, createdBy, ApprovalStatus.APPROVED);
        }

        return { message: EXPENSE_TRACKER_SUCCESS_MESSAGES.CREDIT_SETTLED };
      });
    } catch (error) {
      throw error;
    }
  }

  async createSystemExpense(data: {
    userId: string;
    category: string;
    amount: number;
    description: string;
    createdBy: string;
    referenceId?: string;
    referenceType?: string;
    /** When set (e.g. food allowance tied to an attendance calendar day), use start-of-day instead of "now". */
    expenseDate?: Date;
    approvalAt?: Date;
    transactionType?: string;
  }): Promise<ExpenseTrackerEntity> {
    const referenceType = data.referenceType || SYSTEM_EXPENSE_DEFAULTS.DEFAULT_REFERENCE_TYPE;
    const approvalReason = `${SYSTEM_EXPENSE_DEFAULTS.APPROVAL_REASON_PREFIX}: ${referenceType}`;
    const expenseDate = data.expenseDate ?? new Date();
    const approvalAt = data.approvalAt ?? new Date();
    const transactionType = data.transactionType ?? TransactionType.CREDIT;
    const expense = await this.expenseTrackerRepository.create({
      userId: data.userId,
      category: data.category,
      amount: data.amount,
      description: data.description,
      paymentMode: SYSTEM_EXPENSE_DEFAULTS.PAYMENT_MODE,
      expenseDate,
      isActive: true,
      approvalStatus: ApprovalStatus.APPROVED,
      approvalAt,
      approvalBy: data.createdBy,
      approvalReason,
      transactionType,
      expenseEntryType: ExpenseEntryType.FORCED,
      entrySourceType: EntrySourceType.WEB,
      transactionId: data.referenceId,
      createdBy: data.createdBy,
    });

    return expense;
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
      userRole?: string;
      entrySourceType: EntrySourceType;
      fileKeys: string[];
      timezone?: string;
    },
  ) {
    try {
      const {
        id,
        updatedBy,
        userRole,
        entrySourceType,
        editReason,
        fileKeys,
        category,
        paymentMode,
        expenseDate,
        timezone,
      } = editExpenseDto;
      const expense = await this.findOneOrFail({ where: { id, isActive: true } });

      // Only creator can edit their own expense
      if (expense.createdBy !== updatedBy) {
        throw new BadRequestException(
          EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_EDITED_BY_OTHER_USER,
        );
      }

      // Only pending expenses can be edited
      if (expense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_EDITED);
      }

      // Validate category, payment mode, and expense date
      await this.validateExpenseCategory(category, userRole);
      await this.validatePaymentMode(paymentMode);
      await this.validateExpenseDate(expenseDate, timezone);

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

        const newExpense = await this.expenseTrackerRepository.create(
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

        if (fileKeys && fileKeys.length > 0) {
          await this.expenseFilesService.create(
            {
              expenseId: newExpense.id,
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

  async getExpenseRecords(
    expenseQueryDto: ExpenseQueryDto,
    currentUserId?: string,
  ): Promise<ExpenseListResponseDto> {
    try {
      const { ...filters } = expenseQueryDto;

      // Build all queries
      const { query, countQuery, params, countParams } = buildExpenseListQuery(filters);
      const { openingBalanceQuery, openingBalanceParams, periodTotalsQuery, periodParams } =
        buildExpenseBalanceQuery(filters);
      const {
        openingBalanceQuery: projOpeningQuery,
        openingBalanceParams: projOpeningParams,
        periodTotalsQuery: projPeriodQuery,
        periodParams: projPeriodParams,
      } = buildProjectedBalanceQuery(filters);
      const { summaryQuery, params: summaryParams } = buildExpenseSummaryQuery(filters);

      // Execute all queries in parallel
      const [
        records,
        [{ total }],
        openingBalanceResult,
        periodTotalsResult,
        projOpeningResult,
        projPeriodResult,
        [summaryResult],
      ] = await Promise.all([
        this.expenseTrackerRepository.executeRawQuery(query, params),
        this.expenseTrackerRepository.executeRawQuery(countQuery, countParams),
        this.expenseTrackerRepository.executeRawQuery(openingBalanceQuery, openingBalanceParams),
        this.expenseTrackerRepository.executeRawQuery(periodTotalsQuery, periodParams),
        this.expenseTrackerRepository.executeRawQuery(projOpeningQuery, projOpeningParams),
        this.expenseTrackerRepository.executeRawQuery(projPeriodQuery, projPeriodParams),
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
        relations: ['user', 'approvalByUser', 'createdByUser', 'updatedByUser'],
        order: { versionNumber: SortOrder.ASC },
      });

      // Fetch file keys for all expense versions
      const expenseIds = history.map((record) => record.id);
      const allFiles = await this.expenseFilesService.findAll({
        where: { expenseId: In(expenseIds) },
      });

      // Group files by expenseId
      const filesByExpenseId = allFiles.reduce((acc, file) => {
        if (!acc[file.expenseId]) {
          acc[file.expenseId] = [];
        }
        acc[file.expenseId].push(file.fileKey);
        return acc;
      }, {} as Record<string, string[]>);

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
          fileKeys: filesByExpenseId[record.id] || [],
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

        // Send approval notification (email + WhatsApp)
        this.sendExpenseApprovalNotification(expense, approvalBy, approvalStatus, approvalComment);

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
            case ApprovalStatus.APPROVED: {
              const expense = await this.findOneOrFail({ where: { id: expenseId } });
              if (approvalBy === expense.createdBy) {
                throw new BadRequestException(
                  EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_APPROVED_BY_CREATOR,
                );
              }
              await this.expenseTrackerRepository.update(
                { id: expenseId },
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
              const expense = await this.findOneOrFail({ where: { id: expenseId } });
              if (approvalBy === expense.createdBy) {
                throw new BadRequestException(
                  EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_BE_REJECTED_BY_CREATOR,
                );
              }
              await this.expenseTrackerRepository.update(
                { id: expenseId },
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
              await this.expenseTrackerRepository.update(
                { id: expenseId },
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
      const expense = await this.findOneOrFail({ where: { id } });

      // Check if already deleted
      if (!expense.isActive || expense.deletedAt) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_ALREADY_DELETED);
      }

      // Check ownership - only creator can delete their own entry
      if (expense.createdBy !== deletedBy) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_OTHERS);
      }

      // Check approval status - only pending entries can be deleted
      if (expense.approvalStatus !== ApprovalStatus.PENDING) {
        throw new BadRequestException(
          EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
            '{status}',
            expense.approvalStatus,
          ),
        );
      }

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
    const { expenseIds, deletedBy } = bulkDeleteDto;
    const result = [];
    const errors = [];

    for (const expenseId of expenseIds) {
      try {
        const deletedExpense = await this.validateAndDeleteExpense(expenseId, deletedBy);
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

  private async validateAndDeleteExpense(expenseId: string, deletedBy: string) {
    // Find the expense
    const expense = await this.expenseTrackerRepository.findOne({
      where: { id: expenseId },
    });

    // Check if expense exists
    if (!expense) {
      throw new NotFoundException(EXPENSE_TRACKER_ERRORS.NOT_FOUND);
    }

    // Check if expense is already deleted
    if (!expense.isActive || expense.deletedAt) {
      throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_ALREADY_DELETED);
    }

    // Check ownership - only creator can delete their own entry
    if (expense.createdBy !== deletedBy) {
      throw new BadRequestException(EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_OTHERS);
    }

    // Check approval status - only pending entries can be deleted
    if (expense.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.EXPENSE_CANNOT_DELETE_NON_PENDING.replace(
          '{status}',
          expense.approvalStatus,
        ),
      );
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

  private async getCategoryLabel(categoryName: string): Promise<string> {
    try {
      const config = await this.configurationService.findOneOrFail({
        where: {
          module: CONFIGURATION_MODULES.EXPENSE,
          key: CONFIGURATION_KEYS.EXPENSE_CATEGORIES,
        },
      });
      const configSetting = await this.configSettingService.findOneOrFail({
        where: { configId: config.id, isActive: true },
      });
      const match = configSetting.value.find((item: any) => item.name === categoryName);
      return match?.label || categoryName;
    } catch {
      return categoryName;
    }
  }

  private async sendExpenseApprovalNotification(
    expense: ExpenseTrackerEntity,
    approvalById: string,
    approvalStatus: string,
    approvalComment?: string,
  ) {
    try {
      const approver = await this.userService.findOne({ id: approvalById });
      const employee = expense.user;

      if (!employee) return;

      const isApproved = approvalStatus === ApprovalStatus.APPROVED;
      const approverName = approver
        ? `${approver.firstName} ${approver.lastName}`
        : EXPENSE_EMAIL_CONSTANTS.SYSTEM_USER;
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const amount = `₹${Number(expense.amount).toLocaleString('en-IN')}`;
      const categoryLabel = await this.getCategoryLabel(expense.category);

      // Send Email notification
      if (employee.email) {
        const subjectKey = isApproved
          ? EMAIL_SUBJECT.EXPENSE_APPROVED
          : EMAIL_SUBJECT.EXPENSE_REJECTED;

        await this.emailService.sendMail({
          receiverEmails: employee.email,
          subject: subjectKey.replace('{category}', categoryLabel),
          template: EMAIL_TEMPLATE.EXPENSE_APPROVAL,
          emailData: {
            employeeName,
            isApproved,
            expenseId: expense.id.substring(0, 8).toUpperCase(),
            amount,
            category: categoryLabel,
            expenseDate: this.formatDateForEmail(expense.expenseDate),
            description: expense.description || EXPENSE_EMAIL_CONSTANTS.NOT_APPLICABLE,
            paymentMode: expense.paymentMode,
            approverName,
            approvalDate: this.formatDateForEmail(new Date()),
            remarks: approvalComment,
            portalUrl: `${Environments.FE_BASE_URL}${EMAIL_REDIRECT_ROUTES.EXPENSES}`,
          },
        });
      }

      // Send WhatsApp notification (if user has opted in)
      const whatsappNumber = employee.whatsappNumber || employee.contactNumber;
      if (employee.whatsappOptIn && whatsappNumber) {
        await this.whatsAppService.sendExpenseApproval(
          whatsappNumber,
          {
            employeeName,
            amount,
            category: categoryLabel,
            approverName,
            remarks: approvalComment,
            isApproved,
          },
          {
            referenceId: expense.id,
            recipientId: employee.id,
          },
        );
      }
    } catch (error) {
      Logger.error('Failed to send expense approval notification:', error);
    }
  }

  private formatDateForEmail(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}
