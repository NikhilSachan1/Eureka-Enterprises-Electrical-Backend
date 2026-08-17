import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

/**
 * Read-only, unauthenticated info exposed for pre-login / public surfaces
 * (e.g. the "Contact HR" action). Sourced from the editable
 * `system.notification_emails` configuration — the same value the scheduler
 * uses — so admins manage it via the existing configurations API.
 */
@Injectable()
export class PublicInfoService {
  private readonly logger = new Logger(PublicInfoService.name);

  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
  ) {}

  /** HR email addresses for the public "Contact HR" action. Empty when unconfigured. */
  async getHrContact(): Promise<{ hrEmails: string[] }> {
    try {
      const config = await this.configurationService.findOne({
        where: {
          key: CONFIGURATION_KEYS.NOTIFICATION_EMAILS,
          module: CONFIGURATION_MODULES.SYSTEM,
        },
      });
      if (!config) {
        return { hrEmails: [] };
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: config.id, isActive: true },
      });

      const value = (configSetting?.value ?? {}) as { hrEmails?: unknown };
      const hrEmails = Array.isArray(value.hrEmails)
        ? value.hrEmails.filter((email): email is string => typeof email === 'string')
        : [];

      return { hrEmails };
    } catch (error) {
      this.logger.error('Error fetching HR contact info', error as Error);
      return { hrEmails: [] };
    }
  }
}
