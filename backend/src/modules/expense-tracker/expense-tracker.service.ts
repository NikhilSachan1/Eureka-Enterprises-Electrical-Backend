import { BadRequestException, Injectable } from '@nestjs/common';
import { ExpenseTrackerRepository } from './expense-tracker.repository';
import { CreateCreditExpenseDto, CreateDebitExpenseDto, ForceExpenseDto } from './dto';
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
} from './constants/expense-tracker.constants';

@Injectable()
export class ExpenseTrackerService {
  constructor(
    private readonly expenseTrackerRepository: ExpenseTrackerRepository,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  async createDebitExpense(
    createExpenseDto: CreateDebitExpenseDto & { userId: string; sourceType: EntrySourceType },
  ) {
    try {
      const { category, paymentMode, amount, expenseDate, userId, sourceType } = createExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);
      await this.validateExpenseDate(expenseDate);

      const expense = await this.expenseTrackerRepository.create({
        ...createExpenseDto,
        amount: Number(amount),
        approvalStatus: ApprovalStatus.PENDING,
        transactionType: TransactionType.DEBIT,
        expenseEntryType: ExpenseEntryType.SELF,
        entrySourceType: sourceType,
        createdBy: userId,
      });

      return expense;
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
    const allowedDate = new Date(currentDate.getTime() - allowedDays);

    if (new Date(expenseDate) < allowedDate) {
      throw new BadRequestException(
        EXPENSE_TRACKER_ERRORS.EXPENSE_DATE_TOO_OLD.replace('{days}', allowedDays.toString()),
      );
    }
  }

  async forceExpense(
    forceExpenseDto: ForceExpenseDto & { createdBy: string; sourceType: EntrySourceType },
  ) {
    try {
      const { category, paymentMode, amount, createdBy, sourceType } = forceExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      const expense = await this.expenseTrackerRepository.create({
        ...forceExpenseDto,
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
      return expense;
    } catch (error) {
      throw error;
    }
  }

  async createCreditExpense(
    createExpenseDto: CreateCreditExpenseDto & { createdBy: string; sourceType: EntrySourceType },
  ) {
    try {
      const { category, paymentMode, amount, expenseDate, createdBy, sourceType } =
        createExpenseDto;
      await this.validateExpenseCategory(category);
      await this.validatePaymentMode(paymentMode);

      if (new Date(expenseDate) > new Date()) {
        throw new BadRequestException(EXPENSE_TRACKER_ERRORS.INVALID_EXPENSE_DATE);
      }

      const expense = await this.expenseTrackerRepository.create({
        ...createExpenseDto,
        amount: Number(amount),
        approvalStatus: ApprovalStatus.APPROVED,
        approvalAt: new Date(),
        approvalBy: createdBy,
        approvalReason: DEFAULT_EXPENSE.CREDIT_APPROVAL_REASON,
        transactionType: TransactionType.CREDIT,
        expenseEntryType: ExpenseEntryType.SELF,
        entrySourceType: sourceType,
        createdBy,
      });
      return expense;
    } catch (error) {
      throw error;
    }
  }
}

// TODO: Email notification to the user
