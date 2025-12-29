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
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from '../../../utils/master-constants/master-constants';
import {
  AssetCalibrationExpiryResult,
  AssetCalibrationAlert,
  CalibrationExpiryCount,
  AssetCalibrationEmailData,
  AssetCalibrationEmailItem,
  AssetWarrantyExpiryResult,
  AssetWarrantyAlert,
  WarrantyExpiryCount,
  AssetWarrantyEmailData,
  AssetWarrantyEmailItem,
} from '../types/asset.types';
import {
  getAssetsWithExpiringCalibrationQuery,
  getCalibrationAlertStatus,
  getAssetsWithExpiringWarrantyQuery,
  getWarrantyAlertStatus,
} from '../queries/asset.queries';
import {
  CalibrationStatus,
  WarrantyStatus,
  EXPIRING_SOON_DAYS,
} from '../../asset-masters/constants/asset-masters.constants';
import { Environments } from '../../../../env-configs';

@Injectable()
export class AssetCronService {
  private readonly logger = new Logger(AssetCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly emailService: EmailService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 13: Asset Calibration Expiry Alerts
   *
   * Runs daily at 9:00 AM IST to check for expiring asset calibrations.
   *
   * Scenarios Handled:
   * 1. Calibration already EXPIRED (endDate < today) - Urgent alert
   * 2. Calibration EXPIRING_SOON (endDate within warning days) - Warning alert
   * 3. NON_CALIBRATED assets - Skipped (calibration not applicable)
   * 4. RETIRED assets - Skipped (no alerts needed)
   * 5. Assets without calibrationEndDate - Skipped (no tracking possible)
   * 6. UNDER_MAINTENANCE assets - Included (still need tracking)
   * 7. DAMAGED assets - Included (may still need calibration tracking)
   *
   * Recipients:
   * - Asset Managers / Admins (all alerts)
   * - Assigned users (only their assigned assets)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleAssetCalibrationExpiryAlerts(): Promise<AssetCalibrationExpiryResult> {
    const cronName = CRON_NAMES.ASSET_CALIBRATION_EXPIRY_ALERTS;
    this.schedulerService.logCronStart(cronName);

    const result: AssetCalibrationExpiryResult = {
      totalAssetsProcessed: 0,
      expiredCalibrations: this.initCalibrationCount(),
      expiringSoonCalibrations: this.initCalibrationCount(),
      emailsSent: 0,
      recipients: [],
      errors: [],
    };

    try {
      const warningDays = await this.getExpiryWarningDays();
      this.logger.log(`[${cronName}] Using warning days: ${warningDays}`);

      const { query, params } = getAssetsWithExpiringCalibrationQuery(warningDays);
      const assetsRaw = await this.dataSource.query(query, params);

      if (assetsRaw.length === 0) {
        this.logger.log(`[${cronName}] No assets with expiring calibrations found`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${assetsRaw.length} assets with expiring calibrations`);

      const { assetAlerts, expiredCount, expiringSoonCount } =
        this.processAssetCalibrations(assetsRaw);

      result.totalAssetsProcessed = assetAlerts.length;
      result.expiredCalibrations = expiredCount;
      result.expiringSoonCalibrations = expiringSoonCount;

      const expiredAssets = assetAlerts.filter(
        (asset) => asset.calibration.status === CalibrationStatus.EXPIRED,
      );
      const expiringSoonAssets = assetAlerts.filter(
        (asset) => asset.calibration.status === CalibrationStatus.EXPIRING_SOON,
      );

      if (expiredCount.total > 0 || expiringSoonCount.total > 0) {
        const emailResult = await this.sendCalibrationExpiryAlertEmails(
          expiredAssets,
          expiringSoonAssets,
          expiredCount,
          expiringSoonCount,
          cronName,
        );
        result.emailsSent = emailResult.emailsSent;
        result.recipients = emailResult.recipients;
        result.errors.push(...emailResult.errors);
      }

      for (const asset of assetAlerts) {
        const urgency =
          asset.calibration.status === CalibrationStatus.EXPIRED ? '🔴 EXPIRED' : '🟡 EXPIRING';
        this.logger.debug(
          `[${cronName}] ${urgency}: ${asset.assetId} - ${asset.name} (${asset.calibration.daysUntilExpiry} days)`,
        );
      }

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * CRON 14: Asset Warranty Expiry Alerts
   *
   * Runs daily at 9:00 AM IST to check for expiring asset warranties.
   *
   * Scenarios Handled:
   * 1. Warranty already EXPIRED (endDate < today) - Urgent alert
   * 2. Warranty EXPIRING_SOON (endDate within warning days) - Warning alert
   * 3. RETIRED assets - Skipped (no alerts needed)
   * 4. Assets without warrantyEndDate - Skipped (no tracking possible)
   * 5. UNDER_MAINTENANCE assets - Included (warranty still valid)
   * 6. DAMAGED assets - Included (warranty claims may be needed)
   *
   * Recipients:
   * - Asset Managers / Admins (all alerts)
   * - Assigned users (only their assigned assets)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleAssetWarrantyExpiryAlerts(): Promise<AssetWarrantyExpiryResult> {
    const cronName = CRON_NAMES.ASSET_WARRANTY_EXPIRY_ALERTS;
    this.schedulerService.logCronStart(cronName);

    const result: AssetWarrantyExpiryResult = {
      totalAssetsProcessed: 0,
      expiredWarranties: this.initWarrantyCount(),
      expiringSoonWarranties: this.initWarrantyCount(),
      emailsSent: 0,
      recipients: [],
      errors: [],
    };

    try {
      const warningDays = await this.getExpiryWarningDays();
      this.logger.log(`[${cronName}] Using warning days: ${warningDays}`);

      const { query, params } = getAssetsWithExpiringWarrantyQuery(warningDays);
      const assetsRaw = await this.dataSource.query(query, params);

      if (assetsRaw.length === 0) {
        this.logger.log(`[${cronName}] No assets with expiring warranties found`);
        this.schedulerService.logCronComplete(cronName, result);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${assetsRaw.length} assets with expiring warranties`);

      const { assetAlerts, expiredCount, expiringSoonCount } =
        this.processAssetWarranties(assetsRaw);

      result.totalAssetsProcessed = assetAlerts.length;
      result.expiredWarranties = expiredCount;
      result.expiringSoonWarranties = expiringSoonCount;

      const expiredAssets = assetAlerts.filter(
        (asset) => asset.warranty.status === WarrantyStatus.EXPIRED,
      );
      const expiringSoonAssets = assetAlerts.filter(
        (asset) => asset.warranty.status === WarrantyStatus.EXPIRING_SOON,
      );

      if (expiredCount.total > 0 || expiringSoonCount.total > 0) {
        const emailResult = await this.sendWarrantyExpiryAlertEmails(
          expiredAssets,
          expiringSoonAssets,
          expiredCount,
          expiringSoonCount,
          cronName,
        );
        result.emailsSent = emailResult.emailsSent;
        result.recipients = emailResult.recipients;
        result.errors.push(...emailResult.errors);
      }

      for (const asset of assetAlerts) {
        const urgency =
          asset.warranty.status === WarrantyStatus.EXPIRED ? '🔴 EXPIRED' : '🟡 EXPIRING';
        this.logger.debug(
          `[${cronName}] ${urgency}: ${asset.assetId} - ${asset.name} (${asset.warranty.daysUntilExpiry} days)`,
        );
      }

      this.schedulerService.logCronComplete(cronName, result);
      return result;
    } catch (error) {
      this.schedulerService.logCronError(cronName, error);
      result.errors.push(error.message);
      return result;
    }
  }

  private async getExpiryWarningDays(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.ASSET,
          key: CONFIGURATION_KEYS.ASSET_EXPIRING_SOON_DAYS,
        },
      });

      if (!configuration) {
        this.logger.warn('Asset expiry warning days config not found, using default');
        return EXPIRING_SOON_DAYS;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Asset expiry warning days setting not found, using default');
        return EXPIRING_SOON_DAYS;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching asset expiry warning days, using default');
      return EXPIRING_SOON_DAYS;
    }
  }

  private processAssetCalibrations(assetsRaw: any[]): {
    assetAlerts: AssetCalibrationAlert[];
    expiredCount: CalibrationExpiryCount;
    expiringSoonCount: CalibrationExpiryCount;
  } {
    const assetAlerts: AssetCalibrationAlert[] = [];
    const expiredCount = this.initCalibrationCount();
    const expiringSoonCount = this.initCalibrationCount();

    for (const asset of assetsRaw) {
      const status = getCalibrationAlertStatus(asset.daysUntilExpiry);

      const alert: AssetCalibrationAlert = {
        assetVersionId: asset.assetVersionId,
        assetMasterId: asset.assetMasterId,
        assetId: asset.assetId,
        name: asset.name,
        model: asset.model,
        serialNumber: asset.serialNumber,
        category: asset.category,
        status: asset.status,
        assignedTo: asset.assignedTo,
        assignedUserName: asset.assignedFirstName
          ? `${asset.assignedFirstName} ${asset.assignedLastName || ''}`.trim()
          : null,
        assignedUserEmail: asset.assignedUserEmail,
        calibration: {
          calibrationEndDate: asset.calibrationEndDate,
          daysUntilExpiry: asset.daysUntilExpiry,
          status,
          calibrationFrom: asset.calibrationFrom,
          calibrationFrequency: asset.calibrationFrequency,
        },
      };

      assetAlerts.push(alert);

      if (status === CalibrationStatus.EXPIRED) {
        expiredCount.expired++;
        expiredCount.total++;
      } else {
        expiringSoonCount.expiringSoon++;
        expiringSoonCount.total++;
      }
    }

    return { assetAlerts, expiredCount, expiringSoonCount };
  }

  private async sendCalibrationExpiryAlertEmails(
    expiredAssets: AssetCalibrationAlert[],
    expiringSoonAssets: AssetCalibrationAlert[],
    expiredCount: CalibrationExpiryCount,
    expiringSoonCount: CalibrationExpiryCount,
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

    const emailData: AssetCalibrationEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      totalExpired: expiredCount.total,
      totalExpiringSoon: expiringSoonCount.total,
      expiredAssets: this.formatAssetsForEmail(expiredAssets, CalibrationStatus.EXPIRED),
      expiringSoonAssets: this.formatAssetsForEmail(
        expiringSoonAssets,
        CalibrationStatus.EXPIRING_SOON,
      ),
      hasExpired: expiredCount.total > 0,
      hasExpiringSoon: expiringSoonCount.total > 0,
    };

    // Send to asset managers/admins
    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getEmailSubject(expiredCount.total),
          template: EMAIL_TEMPLATE.ASSET_CALIBRATION_EXPIRY,
          emailData,
        });

        this.logger.log(`[${cronName}] Email sent to admin: ${email}`);
        recipients.push(email);
        emailsSent.count++;
      } catch (error) {
        errors.push(`Failed to send email to ${email}: ${error.message}`);
        this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
      }
    }

    const assignedUserEmails = new Set<string>();
    const allAssets = [...expiredAssets, ...expiringSoonAssets];

    for (const asset of allAssets) {
      if (asset.assignedUserEmail && !assignedUserEmails.has(asset.assignedUserEmail)) {
        assignedUserEmails.add(asset.assignedUserEmail);

        const userAssets = allAssets.filter(
          (asset) => asset.assignedUserEmail === asset.assignedUserEmail,
        );

        const userExpiredAssets = userAssets.filter(
          (asset) => asset.calibration.status === CalibrationStatus.EXPIRED,
        );
        const userExpiringSoonAssets = userAssets.filter(
          (asset) => asset.calibration.status === CalibrationStatus.EXPIRING_SOON,
        );

        const userExpiredCount = userExpiredAssets.length;
        const userExpiringSoonCount = userExpiringSoonAssets.length;

        const userEmailData: AssetCalibrationEmailData = {
          currentYear: new Date().getFullYear(),
          adminPortalUrl: Environments.FE_BASE_URL || '#',
          totalExpired: userExpiredCount,
          totalExpiringSoon: userExpiringSoonCount,
          expiredAssets: this.formatAssetsForEmail(userExpiredAssets, CalibrationStatus.EXPIRED),
          expiringSoonAssets: this.formatAssetsForEmail(
            userExpiringSoonAssets,
            CalibrationStatus.EXPIRING_SOON,
          ),
          hasExpired: userExpiredCount > 0,
          hasExpiringSoon: userExpiringSoonCount > 0,
        };

        try {
          await this.emailService.sendMail({
            receiverEmails: asset.assignedUserEmail,
            subject: this.getEmailSubject(userExpiredCount),
            template: EMAIL_TEMPLATE.ASSET_CALIBRATION_EXPIRY,
            emailData: userEmailData,
          });

          this.logger.log(`[${cronName}] Email sent to assigned user: ${asset.assignedUserEmail}`);
          recipients.push(asset.assignedUserEmail);
          emailsSent.count++;
        } catch (error) {
          errors.push(`Failed to send email to ${asset.assignedUserEmail}: ${error.message}`);
          this.logger.error(
            `[${cronName}] Failed to send email to ${asset.assignedUserEmail}`,
            error,
          );
        }
      }
    }

    return { emailsSent: emailsSent.count, recipients, errors };
  }

  private formatAssetsForEmail(
    assets: AssetCalibrationAlert[],
    filterStatus: CalibrationStatus,
  ): AssetCalibrationEmailItem[] {
    return assets
      .filter((asset) => asset.calibration.status === filterStatus)
      .map((asset) => ({
        assetId: asset.assetId,
        name: asset.name,
        model: asset.model || 'N/A',
        serialNumber: asset.serialNumber || 'N/A',
        category: asset.category,
        assetStatus: this.formatAssetStatus(asset.status),
        assignedTo: asset.assignedUserName || 'Unassigned',
        calibrationEndDate: this.formatDate(asset.calibration.calibrationEndDate),
        calibrationFrom: asset.calibration.calibrationFrom || 'N/A',
        calibrationFrequency: asset.calibration.calibrationFrequency || 'N/A',
        daysText: this.getDaysText(asset.calibration.daysUntilExpiry),
        statusClass:
          asset.calibration.status === CalibrationStatus.EXPIRED ? 'expired' : 'expiring-soon',
      }));
  }

  private getEmailSubject(expiredCount: number): string {
    if (expiredCount > 0) {
      return EMAIL_SUBJECT.ASSET_CALIBRATION_EXPIRY_URGENT;
    }
    return EMAIL_SUBJECT.ASSET_CALIBRATION_EXPIRY;
  }

  private getDaysText(days: number): string {
    if (days < 0) {
      const overdueDays = Math.abs(days);
      return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
    } else if (days === 0) {
      return 'Expires today';
    } else if (days === 1) {
      return 'Expires tomorrow';
    }
    return `${days} days remaining`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private formatAssetStatus(status: string): string {
    const statusMap: Record<string, string> = {
      AVAILABLE: 'Available',
      ASSIGNED: 'Assigned',
      UNDER_MAINTENANCE: 'Under Maintenance',
      DAMAGED: 'Damaged',
      RETIRED: 'Retired',
    };
    return statusMap[status] || status;
  }

  private initCalibrationCount(): CalibrationExpiryCount {
    return { expired: 0, expiringSoon: 0, total: 0 };
  }

  private processAssetWarranties(assetsRaw: any[]): {
    assetAlerts: AssetWarrantyAlert[];
    expiredCount: WarrantyExpiryCount;
    expiringSoonCount: WarrantyExpiryCount;
  } {
    const assetAlerts: AssetWarrantyAlert[] = [];
    const expiredCount = this.initWarrantyCount();
    const expiringSoonCount = this.initWarrantyCount();

    for (const asset of assetsRaw) {
      const status = getWarrantyAlertStatus(asset.daysUntilExpiry);

      const alert: AssetWarrantyAlert = {
        assetVersionId: asset.assetVersionId,
        assetMasterId: asset.assetMasterId,
        assetId: asset.assetId,
        name: asset.name,
        model: asset.model,
        serialNumber: asset.serialNumber,
        category: asset.category,
        status: asset.status,
        assignedTo: asset.assignedTo,
        assignedUserName: asset.assignedFirstName
          ? `${asset.assignedFirstName} ${asset.assignedLastName || ''}`.trim()
          : null,
        assignedUserEmail: asset.assignedUserEmail,
        warranty: {
          warrantyEndDate: asset.warrantyEndDate,
          daysUntilExpiry: asset.daysUntilExpiry,
          status,
          warrantyStartDate: asset.warrantyStartDate,
          vendorName: asset.vendorName,
        },
      };

      assetAlerts.push(alert);

      if (status === WarrantyStatus.EXPIRED) {
        expiredCount.expired++;
        expiredCount.total++;
      } else {
        expiringSoonCount.expiringSoon++;
        expiringSoonCount.total++;
      }
    }

    return { assetAlerts, expiredCount, expiringSoonCount };
  }

  private async sendWarrantyExpiryAlertEmails(
    expiredAssets: AssetWarrantyAlert[],
    expiringSoonAssets: AssetWarrantyAlert[],
    expiredCount: WarrantyExpiryCount,
    expiringSoonCount: WarrantyExpiryCount,
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

    const emailData: AssetWarrantyEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      totalExpired: expiredCount.total,
      totalExpiringSoon: expiringSoonCount.total,
      expiredAssets: this.formatWarrantyAssetsForEmail(expiredAssets, WarrantyStatus.EXPIRED),
      expiringSoonAssets: this.formatWarrantyAssetsForEmail(
        expiringSoonAssets,
        WarrantyStatus.EXPIRING_SOON,
      ),
      hasExpired: expiredCount.total > 0,
      hasExpiringSoon: expiringSoonCount.total > 0,
    };

    // Send to asset managers/admins
    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getWarrantyEmailSubject(expiredCount.total),
          template: EMAIL_TEMPLATE.ASSET_WARRANTY_EXPIRY,
          emailData,
        });

        this.logger.log(`[${cronName}] Email sent to admin: ${email}`);
        recipients.push(email);
        emailsSent.count++;
      } catch (error) {
        errors.push(`Failed to send email to ${email}: ${error.message}`);
        this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
      }
    }

    // Send individual alerts to assigned users
    const assignedUserEmails = new Set<string>();
    const allAssets = [...expiredAssets, ...expiringSoonAssets];

    for (const asset of allAssets) {
      if (asset.assignedUserEmail && !assignedUserEmails.has(asset.assignedUserEmail)) {
        assignedUserEmails.add(asset.assignedUserEmail);

        const userAssets = allAssets.filter(
          (asset) => asset.assignedUserEmail === asset.assignedUserEmail,
        );

        const userExpiredAssets = userAssets.filter(
          (asset) => asset.warranty.status === WarrantyStatus.EXPIRED,
        );
        const userExpiringSoonAssets = userAssets.filter(
          (asset) => asset.warranty.status === WarrantyStatus.EXPIRING_SOON,
        );

        const userExpiredCount = userExpiredAssets.length;
        const userExpiringSoonCount = userExpiringSoonAssets.length;

        const userEmailData: AssetWarrantyEmailData = {
          currentYear: new Date().getFullYear(),
          adminPortalUrl: Environments.FE_BASE_URL || '#',
          totalExpired: userExpiredCount,
          totalExpiringSoon: userExpiringSoonCount,
          expiredAssets: this.formatWarrantyAssetsForEmail(
            userExpiredAssets,
            WarrantyStatus.EXPIRED,
          ),
          expiringSoonAssets: this.formatWarrantyAssetsForEmail(
            userExpiringSoonAssets,
            WarrantyStatus.EXPIRING_SOON,
          ),
          hasExpired: userExpiredCount > 0,
          hasExpiringSoon: userExpiringSoonCount > 0,
        };

        try {
          await this.emailService.sendMail({
            receiverEmails: asset.assignedUserEmail,
            subject: this.getWarrantyEmailSubject(userExpiredCount),
            template: EMAIL_TEMPLATE.ASSET_WARRANTY_EXPIRY,
            emailData: userEmailData,
          });

          this.logger.log(`[${cronName}] Email sent to assigned user: ${asset.assignedUserEmail}`);
          recipients.push(asset.assignedUserEmail);
          emailsSent.count++;
        } catch (error) {
          errors.push(`Failed to send email to ${asset.assignedUserEmail}: ${error.message}`);
          this.logger.error(
            `[${cronName}] Failed to send email to ${asset.assignedUserEmail}`,
            error,
          );
        }
      }
    }

    return { emailsSent: emailsSent.count, recipients, errors };
  }

  private formatWarrantyAssetsForEmail(
    assets: AssetWarrantyAlert[],
    filterStatus: WarrantyStatus,
  ): AssetWarrantyEmailItem[] {
    return assets
      .filter((asset) => asset.warranty.status === filterStatus)
      .map((asset) => ({
        assetId: asset.assetId,
        name: asset.name,
        model: asset.model || 'N/A',
        serialNumber: asset.serialNumber || 'N/A',
        category: asset.category,
        assetStatus: this.formatAssetStatus(asset.status),
        assignedTo: asset.assignedUserName || 'Unassigned',
        warrantyEndDate: this.formatDate(asset.warranty.warrantyEndDate),
        warrantyStartDate: asset.warranty.warrantyStartDate
          ? this.formatDate(asset.warranty.warrantyStartDate)
          : 'N/A',
        vendorName: asset.warranty.vendorName || 'N/A',
        daysText: this.getDaysText(asset.warranty.daysUntilExpiry),
        statusClass: asset.warranty.status === WarrantyStatus.EXPIRED ? 'expired' : 'expiring-soon',
      }));
  }

  private getWarrantyEmailSubject(expiredCount: number): string {
    if (expiredCount > 0) {
      return EMAIL_SUBJECT.ASSET_WARRANTY_EXPIRY_URGENT;
    }
    return EMAIL_SUBJECT.ASSET_WARRANTY_EXPIRY;
  }

  private initWarrantyCount(): WarrantyExpiryCount {
    return { expired: 0, expiringSoon: 0, total: 0 };
  }

  /**
   * Get recipient emails for alerts
   * TODO: Fetch dynamically from user roles (ADMIN, ASSET_MANAGER)
   */
  private async getRecipientEmails(): Promise<string[]> {
    // TODO: Implement dynamic fetching from user roles
    // const users = await this.userService.findByRole(['ADMIN', 'ASSET_MANAGER']);
    // return users.map(u => u.email).filter(Boolean);
    return ['akhil.sachan@coditas.com']; // Placeholder
  }
}
