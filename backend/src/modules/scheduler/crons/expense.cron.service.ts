import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { EmailService } from '../../common/email/email.service';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../../common/email/constants/email.constants';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import {
  PendingExpenseResult,
  PendingExpenseAlert,
  PendingExpenseCount,
  PendingExpenseEmailData,
  ExpenseEmailItem,
  EmployeeExpenseGroup,
  ExpenseQueryResult,
  ExpenseType,
} from '../types/expense.types';
import {
  getPendingRegularExpensesQuery,
  getPendingFuelExpensesQuery,
  DEFAULT_URGENT_THRESHOLD_DAYS,
  formatExpenseCategory,
} from '../queries/expense.queries';
import { Environments } from '../../../../env-configs';

@Injectable()
export class ExpenseCronService {
  private readonly logger = new Logger(ExpenseCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly emailService: EmailService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 16: Pending Expense Approval Reminders
   *
   * Runs daily at 9:00 AM IST to remind approvers about pending expenses.
   *
   * Expense Types:
   * - Regular Expenses (travel, meals, supplies, etc.)
   * - Fuel Expenses (vehicle fuel fill-ups)
   *
   * Scenarios Handled:
   * 1. Regular expenses pending approval - needs admin action
   * 2. Fuel expenses pending approval - needs admin action
   * 3. URGENT: Expenses pending for more than threshold days (configurable, default 7)
   * 4. Grouped by employee for better visibility
   * 5. Inactive versions - Skipped (isActive = false)
   * 6. Deleted expenses - Skipped (deletedAt IS NOT NULL)
   * 7. No pending expenses - No email sent
   *
   * Special Considerations:
   * - Pending expenses delay reimbursements to employees
   * - Long-pending expenses may indicate process issues
   * - Grouped view helps identify employees with multiple pending expenses
   *
   * Recipients:
   * - Admin team (all pending expenses)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handlePendingExpenseReminders(): Promise<PendingExpenseResult | null> {
    const cronName = CRON_NAMES.PENDING_EXPENSE_REMINDERS;

    return this.cronLogService.execute(cronName, CronJobType.EXPENSE, async () => {
      const result: PendingExpenseResult = {
        totalExpensesProcessed: 0,
        pendingCounts: this.initPendingCount(),
        emailsSent: 0,
        recipients: [],
        errors: [],
      };

      // Fetch urgent threshold days from config
      const urgentThresholdDays = await this.getUrgentThresholdDays();
      this.logger.log(`[${cronName}] Using urgent threshold days: ${urgentThresholdDays}`);

      const { query: regularQuery, params: regularParams } = getPendingRegularExpensesQuery();
      const regularExpenses: ExpenseQueryResult[] = await this.dataSource.query(
        regularQuery,
        regularParams,
      );

      const { query: fuelQuery, params: fuelParams } = getPendingFuelExpensesQuery();
      const fuelExpenses: ExpenseQueryResult[] = await this.dataSource.query(fuelQuery, fuelParams);

      const allExpenses = [...regularExpenses, ...fuelExpenses];

      if (allExpenses.length === 0) {
        this.logger.log(`[${cronName}] No pending expenses found`);
        return result;
      }

      this.logger.log(
        `[${cronName}] Found ${allExpenses.length} pending expenses (${regularExpenses.length} regular, ${fuelExpenses.length} fuel)`,
      );

      const { expenseAlerts, pendingCounts } = this.processExpenses(
        allExpenses,
        urgentThresholdDays,
      );

      result.totalExpensesProcessed = expenseAlerts.length;
      result.pendingCounts = pendingCounts;

      const emailResult = await this.sendPendingExpenseAlertEmails(
        expenseAlerts,
        pendingCounts,
        urgentThresholdDays,
        cronName,
      );
      result.emailsSent = emailResult.emailsSent;
      result.recipients = emailResult.recipients;
      result.errors.push(...emailResult.errors);

      // Log summary
      for (const expense of expenseAlerts) {
        const urgency = expense.daysPending >= urgentThresholdDays ? '🔴 URGENT' : '🟡';
        this.logger.debug(
          `[${cronName}] ${urgency}: ${expense.employeeName} - ${expense.category} - ₹${expense.amount} (${expense.daysPending} days)`,
        );
      }

      return result;
    });
  }

  /**
   * Fetch urgent threshold days from database configuration
   * Falls back to DEFAULT_URGENT_THRESHOLD_DAYS if not configured
   */
  private async getUrgentThresholdDays(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.EXPENSE,
          key: CONFIGURATION_KEYS.EXPENSE_URGENT_THRESHOLD_DAYS,
        },
      });

      if (!configuration) {
        this.logger.warn('Expense urgent threshold days config not found, using default');
        return DEFAULT_URGENT_THRESHOLD_DAYS;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Expense urgent threshold days setting not found, using default');
        return DEFAULT_URGENT_THRESHOLD_DAYS;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching expense urgent threshold days, using default');
      return DEFAULT_URGENT_THRESHOLD_DAYS;
    }
  }

  private processExpenses(
    expensesRaw: ExpenseQueryResult[],
    urgentThresholdDays: number,
  ): {
    expenseAlerts: PendingExpenseAlert[];
    pendingCounts: PendingExpenseCount;
  } {
    const expenseAlerts: PendingExpenseAlert[] = [];
    const pendingCounts = this.initPendingCount();

    for (const expense of expensesRaw) {
      const alert: PendingExpenseAlert = {
        expenseId: expense.id,
        expenseType: expense.expenseType,
        employeeId: expense.userId,
        employeeName: `${expense.firstName} ${expense.lastName || ''}`.trim(),
        employeeEmail: expense.email,
        category: expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        expenseDate: expense.expenseDate,
        daysPending: expense.daysPending,
        createdAt: expense.createdAt,
        vehicleRegistrationNo: expense.vehicleRegistrationNo,
        fuelLiters: expense.fuelLiters ? Number(expense.fuelLiters) : undefined,
      };

      expenseAlerts.push(alert);

      if (expense.expenseType === ExpenseType.REGULAR) {
        pendingCounts.regular++;
      } else {
        pendingCounts.fuel++;
      }

      if (expense.daysPending >= urgentThresholdDays) {
        pendingCounts.urgent++;
      }

      pendingCounts.total++;
    }

    return { expenseAlerts, pendingCounts };
  }

  private async sendPendingExpenseAlertEmails(
    expenseAlerts: PendingExpenseAlert[],
    pendingCounts: PendingExpenseCount,
    urgentThresholdDays: number,
    cronName: string,
  ): Promise<{ emailsSent: number; recipients: string[]; errors: string[] }> {
    const emailsSent = { count: 0 };
    const recipients: string[] = [];
    const errors: string[] = [];

    const recipientEmails = await this.getRecipientEmails();

    if (recipientEmails.length === 0) {
      this.logger.warn(`[${cronName}] No recipient emails found`);
      return { emailsSent: 0, recipients: [], errors: ['No recipient emails configured'] };
    }

    // Separate urgent and regular pending
    const urgentExpenses = expenseAlerts.filter(
      (expense) => expense.daysPending >= urgentThresholdDays,
    );
    const pendingExpenses = expenseAlerts.filter(
      (expense) => expense.daysPending < urgentThresholdDays,
    );

    const employeeGroups = this.groupExpensesByEmployee(expenseAlerts, urgentThresholdDays);

    const totalAmount = expenseAlerts.reduce((sum, expense) => sum + expense.amount, 0);

    const emailData: PendingExpenseEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      totalPending: pendingCounts.total,
      totalUrgent: pendingCounts.urgent,
      totalRegular: pendingCounts.regular,
      totalFuel: pendingCounts.fuel,
      totalAmount: this.formatCurrency(totalAmount),
      urgentExpenses: this.formatExpensesForEmail(urgentExpenses, true),
      pendingExpenses: this.formatExpensesForEmail(pendingExpenses, false),
      employeeGroups: employeeGroups,
      hasUrgent: pendingCounts.urgent > 0,
      hasPending: pendingCounts.total - pendingCounts.urgent > 0,
      urgentThresholdDays: urgentThresholdDays,
    };

    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getEmailSubject(pendingCounts.urgent),
          template: EMAIL_TEMPLATE.PENDING_EXPENSE_REMINDER,
          emailData,
        });

        this.logger.log(`[${cronName}] Email sent to: ${email}`);
        recipients.push(email);
        emailsSent.count++;
      } catch (error) {
        errors.push(`Failed to send email to ${email}: ${error.message}`);
        this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
      }
    }

    return { emailsSent: emailsSent.count, recipients, errors };
  }

  private formatExpensesForEmail(
    expenses: PendingExpenseAlert[],
    isUrgent: boolean,
  ): ExpenseEmailItem[] {
    return expenses.map((expense) => ({
      expenseId: expense.expenseId,
      expenseType: expense.expenseType,
      expenseTypeLabel: expense.expenseType === ExpenseType.FUEL ? 'Fuel Expense' : 'Expense',
      employeeName: expense.employeeName,
      category: formatExpenseCategory(expense.category),
      description: expense.description || 'No description',
      amount: this.formatCurrency(expense.amount),
      expenseDate: this.formatDate(expense.expenseDate),
      daysPending: expense.daysPending,
      daysText: this.getDaysText(expense.daysPending),
      statusClass: isUrgent ? 'urgent' : 'pending',
      vehicleRegistrationNo: expense.vehicleRegistrationNo,
      fuelLiters: expense.fuelLiters ? `${expense.fuelLiters.toFixed(2)} L` : undefined,
      isFuelExpense: expense.expenseType === ExpenseType.FUEL,
    }));
  }

  private groupExpensesByEmployee(
    expenses: PendingExpenseAlert[],
    urgentThresholdDays: number,
  ): EmployeeExpenseGroup[] {
    const groupMap = new Map<string, EmployeeExpenseGroup>();

    for (const expense of expenses) {
      if (!groupMap.has(expense.employeeId)) {
        groupMap.set(expense.employeeId, {
          employeeId: expense.employeeId,
          employeeName: expense.employeeName,
          employeeEmail: expense.employeeEmail,
          expenses: [],
          totalAmount: 0,
          expenseCount: 0,
        });
      }

      const group = groupMap.get(expense.employeeId)!;
      group.expenses.push({
        expenseId: expense.expenseId,
        expenseType: expense.expenseType,
        expenseTypeLabel: expense.expenseType === ExpenseType.FUEL ? 'Fuel' : 'Expense',
        employeeName: expense.employeeName,
        category: formatExpenseCategory(expense.category),
        description: expense.description || 'No description',
        amount: this.formatCurrency(expense.amount),
        expenseDate: this.formatDate(expense.expenseDate),
        daysPending: expense.daysPending,
        daysText: this.getDaysText(expense.daysPending),
        statusClass: expense.daysPending >= urgentThresholdDays ? 'urgent' : 'pending',
        vehicleRegistrationNo: expense.vehicleRegistrationNo,
        fuelLiters: expense.fuelLiters ? `${expense.fuelLiters.toFixed(2)} L` : undefined,
        isFuelExpense: expense.expenseType === ExpenseType.FUEL,
      });
      group.totalAmount += expense.amount;
      group.expenseCount++;
    }

    return Array.from(groupMap.values()).sort(
      (group1, group2) => group2.totalAmount - group1.totalAmount,
    );
  }

  private getEmailSubject(urgentCount: number): string {
    if (urgentCount > 0) {
      return EMAIL_SUBJECT.PENDING_EXPENSE_REMINDER_URGENT;
    }
    return EMAIL_SUBJECT.PENDING_EXPENSE_REMINDER;
  }

  private getDaysText(days: number): string {
    if (days === 0) {
      return 'Submitted today';
    } else if (days === 1) {
      return '1 day pending';
    }
    return `${days} days pending`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private initPendingCount(): PendingExpenseCount {
    return { regular: 0, fuel: 0, total: 0, urgent: 0 };
  }

  /**
   * Get recipient emails for alerts
   * TODO: Fetch dynamically from user roles (ADMIN, FINANCE, MANAGER)
   */
  private async getRecipientEmails(): Promise<string[]> {
    // TODO: Implement dynamic fetching from user roles
    // const users = await this.userService.findByRole(['ADMIN', 'FINANCE', 'MANAGER']);
    // return users.map(u => u.email).filter(Boolean);
    return ['akhil.sachan@coditas.com']; // Placeholder
  }
}
