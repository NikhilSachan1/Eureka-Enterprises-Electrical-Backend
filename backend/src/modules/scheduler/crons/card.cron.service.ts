import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchedulerService } from '../scheduler.service';
import { EmailService } from '../../common/email/email.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../../common/email/constants/email.constants';
import { ConfigurationService } from '../../configurations/configuration.service';
import { ConfigSettingService } from '../../config-settings/config-setting.service';
import { CRON_SCHEDULES, CRON_NAMES } from '../constants/scheduler.constants';
import { CronLogService } from '../../cron-logs/cron-log.service';
import { CronJobType } from '../../cron-logs/constants/cron-log.constants';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import {
  CardExpiryResult,
  CardAlert,
  CardExpiryCount,
  CardExpiryEmailData,
  CardEmailItem,
  CardQueryResult,
} from '../types/card.types';
import {
  getCardsWithExpiryQuery,
  getCardExpiryStatus,
  getCardTypeLabel,
  maskCardNumber,
} from '../queries/card.queries';
import {
  CardExpiryStatus,
  DEFAULT_CARD_EXPIRY_WARNING_DAYS,
} from '../../cards/constants/card.constants';
import { Environments } from '../../../../env-configs';

@Injectable()
export class CardCronService {
  private readonly logger = new Logger(CardCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly emailService: EmailService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 15: Card Expiry Alerts
   *
   * Runs daily at 9:00 AM IST to check for expiring cards.
   *
   * Card Types:
   * - Petro Cards (fuel cards for vehicles)
   * - Toll Cards (for highway tolls)
   * - Fleet Cards (multi-purpose fleet management)
   * - Other cards
   *
   * Scenarios Handled:
   * 1. Card already EXPIRED (expiryDate < today) - Urgent alert
   * 2. Card EXPIRING_SOON (expiryDate within warning days) - Warning alert
   * 3. Deleted cards - Skipped (soft deleted)
   * 4. Cards without valid expiryDate format - Handled gracefully
   *
   * Special Considerations:
   * - Expired cards may cause payment failures at fuel stations/tolls
   * - Cards should be renewed before expiry to avoid service disruption
   * - Some cards may take days/weeks to renew - early warning is critical
   *
   * Recipients:
   * - Finance/Admin team (all alerts)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_CARD_ALERTS)
  async handleCardExpiryAlerts(): Promise<CardExpiryResult> {
    const cronName = CRON_NAMES.CARD_EXPIRY_ALERTS;
    const cronLog = await this.cronLogService.start(cronName, CronJobType.CARD);

    const result: CardExpiryResult = {
      totalCardsProcessed: 0,
      expiredCards: this.initCardCount(),
      expiringSoonCards: this.initCardCount(),
      emailsSent: 0,
      recipients: [],
      errors: [],
    };

    try {
      const warningDays = await this.getExpiryWarningDays();
      this.logger.log(`[${cronName}] Using warning days: ${warningDays}`);

      const { query, params } = getCardsWithExpiryQuery(warningDays);
      const cardsRaw: CardQueryResult[] = await this.dataSource.query(query, params);

      if (cardsRaw.length === 0) {
        this.logger.log(`[${cronName}] No cards with expiring dates found`);
        await this.cronLogService.success(cronLog.id, result);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${cardsRaw.length} cards with expiring dates`);

      const { cardAlerts, expiredCount, expiringSoonCount } = this.processCards(cardsRaw);

      result.totalCardsProcessed = cardAlerts.length;
      result.expiredCards = expiredCount;
      result.expiringSoonCards = expiringSoonCount;

      const expiredCards = cardAlerts.filter((card) => card.status === CardExpiryStatus.EXPIRED);
      const expiringSoonCards = cardAlerts.filter(
        (card) => card.status === CardExpiryStatus.EXPIRING_SOON,
      );

      if (expiredCount.total > 0 || expiringSoonCount.total > 0) {
        const emailResult = await this.sendCardExpiryAlertEmails(
          expiredCards,
          expiringSoonCards,
          expiredCount,
          expiringSoonCount,
          cronName,
        );
        result.emailsSent = emailResult.emailsSent;
        result.recipients = emailResult.recipients;
        result.errors.push(...emailResult.errors);
      }

      // Log summary
      for (const card of cardAlerts) {
        const urgency = card.status === CardExpiryStatus.EXPIRED ? '🔴 EXPIRED' : '🟡 EXPIRING';
        this.logger.debug(
          `[${cronName}] ${urgency}: ${maskCardNumber(card.cardNumber)} - ${card.cardType} (${
            card.daysUntilExpiry
          } days)`,
        );
      }

      await this.cronLogService.success(cronLog.id, result);
      return result;
    } catch (error) {
      await this.cronLogService.fail(cronLog.id, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private async getExpiryWarningDays(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.CARD,
          key: CONFIGURATION_KEYS.CARD_EXPIRY_WARNING_DAYS,
        },
      });

      if (!configuration) {
        this.logger.warn('Card expiry warning days config not found, using default');
        return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Card expiry warning days setting not found, using default');
        return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
      }

      const value = configSetting.value;
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return typeof parsed === 'number' ? parsed : DEFAULT_CARD_EXPIRY_WARNING_DAYS;
    } catch {
      this.logger.warn('Error fetching card expiry warning days, using default');
      return DEFAULT_CARD_EXPIRY_WARNING_DAYS;
    }
  }

  private processCards(cardsRaw: CardQueryResult[]): {
    cardAlerts: CardAlert[];
    expiredCount: CardExpiryCount;
    expiringSoonCount: CardExpiryCount;
  } {
    const cardAlerts: CardAlert[] = [];
    const expiredCount = this.initCardCount();
    const expiringSoonCount = this.initCardCount();

    for (const card of cardsRaw) {
      const status = getCardExpiryStatus(card.daysUntilExpiry);

      const alert: CardAlert = {
        cardId: card.id,
        cardNumber: card.cardNumber,
        cardType: card.cardType,
        holderName: card.holderName,
        expiryDate: card.expiryDate,
        daysUntilExpiry: card.daysUntilExpiry,
        status,
      };

      cardAlerts.push(alert);

      if (status === CardExpiryStatus.EXPIRED) {
        expiredCount.expired++;
        expiredCount.total++;
      } else {
        expiringSoonCount.expiringSoon++;
        expiringSoonCount.total++;
      }
    }

    return { cardAlerts, expiredCount, expiringSoonCount };
  }

  private async sendCardExpiryAlertEmails(
    expiredCards: CardAlert[],
    expiringSoonCards: CardAlert[],
    expiredCount: CardExpiryCount,
    expiringSoonCount: CardExpiryCount,
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

    const emailData: CardExpiryEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      totalExpired: expiredCount.total,
      totalExpiringSoon: expiringSoonCount.total,
      expiredCards: this.formatCardsForEmail(expiredCards, CardExpiryStatus.EXPIRED),
      expiringSoonCards: this.formatCardsForEmail(
        expiringSoonCards,
        CardExpiryStatus.EXPIRING_SOON,
      ),
      hasExpired: expiredCount.total > 0,
      hasExpiringSoon: expiringSoonCount.total > 0,
    };

    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getEmailSubject(expiredCount.total),
          template: EMAIL_TEMPLATE.CARD_EXPIRY,
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

  private formatCardsForEmail(cards: CardAlert[], filterStatus: CardExpiryStatus): CardEmailItem[] {
    return cards
      .filter((card) => card.status === filterStatus)
      .map((card) => ({
        cardId: card.cardId,
        cardNumber: card.cardNumber,
        maskedCardNumber: maskCardNumber(card.cardNumber),
        cardType: card.cardType,
        cardTypeLabel: getCardTypeLabel(card.cardType),
        holderName: card.holderName,
        expiryDate: this.formatExpiryDate(card.expiryDate),
        daysText: this.getDaysText(card.daysUntilExpiry),
        statusClass: card.status === CardExpiryStatus.EXPIRED ? 'expired' : 'expiring-soon',
      }));
  }

  private getEmailSubject(expiredCount: number): string {
    if (expiredCount > 0) {
      return EMAIL_SUBJECT.CARD_EXPIRY_URGENT;
    }
    return EMAIL_SUBJECT.CARD_EXPIRY;
  }

  private getDaysText(days: number): string {
    if (days < 0) {
      const overdueDays = Math.abs(days);
      return overdueDays === 1 ? '1 day expired' : `${overdueDays} days expired`;
    } else if (days === 0) {
      return 'Expires today';
    } else if (days === 1) {
      return 'Expires tomorrow';
    }
    return `${days} days remaining`;
  }

  private formatExpiryDate(expiryDate: string): string {
    if (!expiryDate || !expiryDate.includes('/')) {
      return expiryDate || 'N/A';
    }

    try {
      const [month, year] = expiryDate.split('/');
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthIndex = parseInt(month, 10) - 1;
      const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
      return `${monthNames[monthIndex]} ${fullYear}`;
    } catch {
      return expiryDate;
    }
  }

  private initCardCount(): CardExpiryCount {
    return { expired: 0, expiringSoon: 0, total: 0 };
  }

  /**
   * Get recipient emails for alerts
   * TODO: Fetch dynamically from user roles (ADMIN, FINANCE)
   */
  private async getRecipientEmails(): Promise<string[]> {
    return this.schedulerService.getNotificationEmails(['admin']);
  }
}
