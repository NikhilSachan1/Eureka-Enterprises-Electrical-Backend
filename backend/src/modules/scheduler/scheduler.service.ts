import { Injectable, Logger } from '@nestjs/common';
import { DateTimeService } from 'src/utils/datetime';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { NotificationEmailsConfig } from './types/scheduler.types';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly ORG_TIMEZONE = 'Asia/Kolkata'; // Organization timezone

  constructor(
    private readonly dateTimeService: DateTimeService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  getCurrentDateIST(): Date {
    return this.dateTimeService.getNowInTimezone(this.ORG_TIMEZONE);
  }

  getTodayDateIST(): Date {
    return this.dateTimeService.getStartOfToday(this.ORG_TIMEZONE);
  }

  getTodayStringIST(): string {
    return this.dateTimeService.getTodayString(this.ORG_TIMEZONE);
  }

  getOrgTimezone(): string {
    return this.ORG_TIMEZONE;
  }

  logCronStart(cronName: string): void {
    this.logger.log(`[${cronName}] Started at ${new Date().toISOString()}`);
  }

  logCronComplete(cronName: string, result: any): void {
    this.logger.log(`[${cronName}] Completed at ${new Date().toISOString()}`, result);
  }

  logCronError(cronName: string, error: Error): void {
    this.logger.error(`[${cronName}] Error at ${new Date().toISOString()}`, error.stack);
  }

  async getNotificationEmailsConfig(): Promise<NotificationEmailsConfig> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.NOTIFICATION_EMAILS,
          module: CONFIGURATION_MODULES.SYSTEM,
        },
      });

      if (!config) {
        this.logger.warn('Notification emails configuration not found');
        return this.getDefaultNotificationEmails();
      }

      const configSetting = await this.configSettingService.findOne({
        where: {
          configId: config.id,
          isActive: true,
        },
      });

      if (!configSetting?.value) {
        this.logger.warn('Notification emails config setting not found or inactive');
        return this.getDefaultNotificationEmails();
      }

      const emailConfig = configSetting.value as Partial<NotificationEmailsConfig>;

      // Combine all emails for general notifications
      const allNotificationEmails = [
        ...(emailConfig.adminEmails || []),
        ...(emailConfig.hrEmails || []),
        ...(emailConfig.financeEmails || []),
        ...(emailConfig.assetManagerEmails || []),
      ].filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates

      return {
        adminEmails: emailConfig.adminEmails || [],
        hrEmails: emailConfig.hrEmails || [],
        financeEmails: emailConfig.financeEmails || [],
        assetManagerEmails: emailConfig.assetManagerEmails || [],
        cronFailureEmails: emailConfig.cronFailureEmails || [],
        allNotificationEmails,
      };
    } catch (error) {
      this.logger.error('Error fetching notification emails config', error);
      return this.getDefaultNotificationEmails();
    }
  }

  async getNotificationEmails(
    categories: ('admin' | 'hr' | 'finance' | 'asset')[] = ['admin'],
  ): Promise<string[]> {
    const config = await this.getNotificationEmailsConfig();
    const emails: string[] = [];

    for (const category of categories) {
      switch (category) {
        case 'admin':
          emails.push(...config.adminEmails);
          break;
        case 'hr':
          emails.push(...config.hrEmails);
          break;
        case 'finance':
          emails.push(...config.financeEmails);
          break;
        case 'asset':
          emails.push(...config.assetManagerEmails);
          break;
      }
    }

    // Return unique emails
    return [...new Set(emails)];
  }

  private getDefaultNotificationEmails(): NotificationEmailsConfig {
    return {
      adminEmails: [],
      hrEmails: [],
      financeEmails: [],
      assetManagerEmails: [],
      cronFailureEmails: [],
      allNotificationEmails: [],
    };
  }
}
