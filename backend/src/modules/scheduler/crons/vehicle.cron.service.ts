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
  VehicleDocumentExpiryResult,
  VehicleDocumentAlert,
  DocumentAlert,
  VehicleDocumentType,
  DocumentAlertStatus,
  VehicleDocumentEmailData,
  VehicleDocumentEmailItem,
  DocumentExpiryCount,
  VehicleServiceDueResult,
  VehicleServiceAlert,
  ServiceDueAlertStatus,
  VehicleServiceDueEmailData,
  VehicleServiceEmailItem,
} from '../types/vehicle.types';
import {
  getVehiclesWithExpiringDocumentsQuery,
  getDocumentAlertStatus,
  getDocumentTypeLabel,
  getVehiclesWithServiceDueQuery,
} from '../queries/vehicle.queries';
import { DEFAULT_EXPIRING_SOON_DAYS } from '../../vehicle-masters/constants/vehicle-masters.constants';
import { Environments } from '../../../../env-configs';
import {
  DEFAULT_SERVICE_INTERVAL_KM,
  DEFAULT_SERVICE_WARNING_KM,
} from '../constants/scheduler.constants';

@Injectable()
export class VehicleCronService {
  private readonly logger = new Logger(VehicleCronService.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly emailService: EmailService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly cronLogService: CronLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * CRON 11: Vehicle Document Expiry Alerts
   *
   * Runs daily at 9:00 AM IST to check for expiring vehicle documents:
   * - Insurance
   * - PUC (Pollution Under Control)
   * - Fitness Certificate
   *
   * Scenarios Handled:
   * 1. Documents already EXPIRED (endDate < today) - Urgent alert
   * 2. Documents EXPIRING_SOON (endDate within warning days) - Warning alert
   * 3. Retired vehicles - Skipped (no alerts needed)
   * 4. Documents without dates - Skipped (no expiry tracking)
   * 5. Multiple documents expiring on same vehicle - Grouped in single email
   *
   * Recipients:
   * - All Admins / Admin (TODO: Fetch dynamically from roles)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleVehicleDocumentExpiryAlerts(): Promise<VehicleDocumentExpiryResult | null> {
    const cronName = CRON_NAMES.VEHICLE_DOCUMENT_EXPIRY_ALERTS;

    return this.cronLogService.execute(cronName, CronJobType.VEHICLE, async () => {
      const result: VehicleDocumentExpiryResult = {
        totalVehiclesProcessed: 0,
        expiredDocuments: this.initDocumentCount(),
        expiringSoonDocuments: this.initDocumentCount(),
        emailsSent: 0,
        recipients: [],
        errors: [],
      };

      const warningDays = await this.getExpiryWarningDays();
      this.logger.log(`[${cronName}] Using warning days: ${warningDays}`);

      const { query, params } = getVehiclesWithExpiringDocumentsQuery(warningDays);
      const vehiclesRaw = await this.dataSource.query(query, params);

      if (vehiclesRaw.length === 0) {
        this.logger.log(`[${cronName}] No vehicles with expiring documents found`);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${vehiclesRaw.length} vehicles with expiring documents`);

      const { vehicleAlerts, expiredCount, expiringSoonCount } = this.processVehicleDocuments(
        vehiclesRaw,
        warningDays,
      );

      result.totalVehiclesProcessed = vehicleAlerts.length;
      result.expiredDocuments = expiredCount;
      result.expiringSoonDocuments = expiringSoonCount;

      const expiredVehicles = vehicleAlerts.filter((vehicle: VehicleDocumentAlert) =>
        vehicle.documents.some(
          (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRED,
        ),
      );
      const expiringSoonVehicles = vehicleAlerts.filter(
        (vehicle: VehicleDocumentAlert) =>
          !vehicle.documents.some(
            (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRED,
          ) &&
          vehicle.documents.some(
            (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRING_SOON,
          ),
      );

      // Send email alerts
      if (expiredCount.total > 0 || expiringSoonCount.total > 0) {
        const emailResult = await this.sendExpiryAlertEmails(
          expiredVehicles,
          expiringSoonVehicles,
          expiredCount,
          expiringSoonCount,
          cronName,
        );
        result.emailsSent = emailResult.emailsSent;
        result.recipients = emailResult.recipients;
        result.errors.push(...emailResult.errors);
      }

      for (const vehicle of vehicleAlerts) {
        for (const doc of vehicle.documents) {
          const urgency = doc.status === DocumentAlertStatus.EXPIRED ? '🔴 EXPIRED' : '🟡 EXPIRING';
          this.logger.debug(
            `[${cronName}] ${urgency}: ${vehicle.registrationNo} - ${doc.label} (${doc.daysUntilExpiry} days)`,
          );
        }
      }

      return result;
    });
  }

  /**
   * CRON 12: Vehicle Service Due Reminders
   *
   * Runs daily at 9:00 AM IST to check for vehicles with service due based on KM:
   *
   * Scenarios Handled:
   * 1. OVERDUE - Vehicle has crossed service interval (kmToNextService <= 0)
   * 2. DUE_SOON - Vehicle approaching service (0 < kmToNextService <= warningKm)
   * 3. No service history - Skipped (lastServiceKm is null)
   * 4. No odometer reading - Skipped (currentOdometerKm is 0)
   * 5. Retired vehicles - Skipped (status = RETIRED)
   *
   * Configuration:
   * - serviceIntervalKm: From config (default: 10000 km)
   * - warningKm: From config (default: 1000 km)
   *
   * Recipients:
   * - All Admins (TODO: Fetch dynamically from roles)
   * - Assigned users (if vehicle is assigned to someone)
   */
  @Cron(CRON_SCHEDULES.DAILY_9AM_IST)
  async handleVehicleServiceDueReminders(): Promise<VehicleServiceDueResult | null> {
    const cronName = CRON_NAMES.VEHICLE_SERVICE_DUE_REMINDERS;

    return this.cronLogService.execute(cronName, CronJobType.VEHICLE, async () => {
      const result: VehicleServiceDueResult = {
        totalVehiclesProcessed: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        skippedNoServiceHistory: 0,
        skippedNoOdometer: 0,
        emailsSent: 0,
        recipients: [],
        errors: [],
      };

      const serviceIntervalKm = await this.getServiceIntervalKm();
      const warningKm = await this.getServiceWarningKm();

      this.logger.log(
        `[${cronName}] Using service interval: ${serviceIntervalKm} km, warning threshold: ${warningKm} km`,
      );

      const { query, params } = getVehiclesWithServiceDueQuery(serviceIntervalKm, warningKm);
      const vehiclesRaw = await this.dataSource.query(query, params);

      if (vehiclesRaw.length === 0) {
        this.logger.log(`[${cronName}] No vehicles with service due found`);
        return result;
      }

      this.logger.log(`[${cronName}] Found ${vehiclesRaw.length} vehicles with service due`);

      const { vehicleAlerts, overdueCount, dueSoonCount } =
        this.processVehicleServiceData(vehiclesRaw);

      result.totalVehiclesProcessed = vehicleAlerts.length;
      result.overdueCount = overdueCount;
      result.dueSoonCount = dueSoonCount;

      const overdueVehicles = vehicleAlerts.filter(
        (v) => v.status === ServiceDueAlertStatus.OVERDUE,
      );
      const dueSoonVehicles = vehicleAlerts.filter(
        (v) => v.status === ServiceDueAlertStatus.DUE_SOON,
      );

      if (overdueCount > 0 || dueSoonCount > 0) {
        const emailResult = await this.sendServiceDueAlertEmails(
          overdueVehicles,
          dueSoonVehicles,
          serviceIntervalKm,
          warningKm,
          cronName,
        );
        result.emailsSent = emailResult.emailsSent;
        result.recipients = emailResult.recipients;
        result.errors.push(...emailResult.errors);
      }

      for (const vehicle of vehicleAlerts) {
        const urgency = vehicle.status === ServiceDueAlertStatus.OVERDUE ? '🔴 OVERDUE' : '🟡 DUE';
        this.logger.debug(
          `[${cronName}] ${urgency}: ${vehicle.registrationNo} - ${Math.abs(
            vehicle.kmToNextService,
          )} km ${vehicle.kmToNextService < 0 ? 'overdue' : 'to service'}`,
        );
      }

      return result;
    });
  }

  private async getServiceIntervalKm(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.VEHICLE,
          key: CONFIGURATION_KEYS.VEHICLE_SERVICE_INTERVAL_KM,
        },
      });

      if (!configuration) {
        this.logger.warn('Vehicle service interval config not found, using default');
        return DEFAULT_SERVICE_INTERVAL_KM;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Vehicle service interval setting not found, using default');
        return DEFAULT_SERVICE_INTERVAL_KM;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching vehicle service interval, using default');
      return DEFAULT_SERVICE_INTERVAL_KM;
    }
  }

  private async getServiceWarningKm(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.VEHICLE,
          key: CONFIGURATION_KEYS.VEHICLE_SERVICE_WARNING_KM,
        },
      });

      if (!configuration) {
        this.logger.warn('Vehicle service warning config not found, using default');
        return DEFAULT_SERVICE_WARNING_KM;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Vehicle service warning setting not found, using default');
        return DEFAULT_SERVICE_WARNING_KM;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching vehicle service warning, using default');
      return DEFAULT_SERVICE_WARNING_KM;
    }
  }

  private processVehicleServiceData(vehiclesRaw: any[]): {
    vehicleAlerts: VehicleServiceAlert[];
    overdueCount: number;
    dueSoonCount: number;
  } {
    const vehicleAlerts: VehicleServiceAlert[] = [];
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const vehicle of vehiclesRaw) {
      const status =
        vehicle.kmToNextService <= 0
          ? ServiceDueAlertStatus.OVERDUE
          : ServiceDueAlertStatus.DUE_SOON;

      if (status === ServiceDueAlertStatus.OVERDUE) {
        overdueCount++;
      } else {
        dueSoonCount++;
      }

      vehicleAlerts.push({
        vehicleMasterId: vehicle.vehicleMasterId,
        registrationNo: vehicle.registrationNo,
        number: vehicle.number,
        brand: vehicle.brand,
        model: vehicle.model,
        assignedTo: vehicle.assignedTo,
        assignedUserName: vehicle.assignedFirstName
          ? `${vehicle.assignedFirstName} ${vehicle.assignedLastName || ''}`.trim()
          : null,
        assignedUserEmail: vehicle.assignedUserEmail,
        lastServiceKm: vehicle.lastServiceKm,
        lastServiceDate: vehicle.lastServiceDate,
        currentOdometerKm: vehicle.currentOdometerKm,
        nextServiceDueKm: vehicle.nextServiceDueKm,
        kmToNextService: vehicle.kmToNextService,
        kmSinceLastService: vehicle.kmSinceLastService,
        status,
      });
    }

    return { vehicleAlerts, overdueCount, dueSoonCount };
  }

  private async sendServiceDueAlertEmails(
    overdueVehicles: VehicleServiceAlert[],
    dueSoonVehicles: VehicleServiceAlert[],
    serviceIntervalKm: number,
    warningKm: number,
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

    const emailData: VehicleServiceDueEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      serviceIntervalKm,
      warningKm,
      totalOverdue: overdueVehicles.length,
      totalDueSoon: dueSoonVehicles.length,
      overdueVehicles: this.formatServiceVehiclesForEmail(overdueVehicles),
      dueSoonVehicles: this.formatServiceVehiclesForEmail(dueSoonVehicles),
      hasOverdue: overdueVehicles.length > 0,
      hasDueSoon: dueSoonVehicles.length > 0,
    };

    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getServiceEmailSubject(overdueVehicles.length),
          template: EMAIL_TEMPLATE.VEHICLE_SERVICE_DUE,
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

    // Send individual alerts to assigned users
    const assignedUserEmails = new Set<string>();
    const allVehicles = [...overdueVehicles, ...dueSoonVehicles];

    for (const vehicle of allVehicles) {
      if (vehicle.assignedUserEmail && !assignedUserEmails.has(vehicle.assignedUserEmail)) {
        assignedUserEmails.add(vehicle.assignedUserEmail);

        const userVehicles = allVehicles.filter(
          (v) => v.assignedUserEmail === vehicle.assignedUserEmail,
        );
        const userOverdueVehicles = userVehicles.filter(
          (v) => v.status === ServiceDueAlertStatus.OVERDUE,
        );
        const userDueSoonVehicles = userVehicles.filter(
          (v) => v.status === ServiceDueAlertStatus.DUE_SOON,
        );

        const userEmailData: VehicleServiceDueEmailData = {
          currentYear: new Date().getFullYear(),
          adminPortalUrl: Environments.FE_BASE_URL || '#',
          serviceIntervalKm,
          warningKm,
          totalOverdue: userOverdueVehicles.length,
          totalDueSoon: userDueSoonVehicles.length,
          overdueVehicles: this.formatServiceVehiclesForEmail(userOverdueVehicles),
          dueSoonVehicles: this.formatServiceVehiclesForEmail(userDueSoonVehicles),
          hasOverdue: userOverdueVehicles.length > 0,
          hasDueSoon: userDueSoonVehicles.length > 0,
        };

        try {
          await this.emailService.sendMail({
            receiverEmails: vehicle.assignedUserEmail,
            subject: this.getServiceEmailSubject(userOverdueVehicles.length),
            template: EMAIL_TEMPLATE.VEHICLE_SERVICE_DUE,
            emailData: userEmailData,
          });

          this.logger.log(
            `[${cronName}] Email sent to assigned user: ${vehicle.assignedUserEmail}`,
          );
          recipients.push(vehicle.assignedUserEmail);
          emailsSent.count++;
        } catch (error) {
          errors.push(`Failed to send email to ${vehicle.assignedUserEmail}: ${error.message}`);
          this.logger.error(
            `[${cronName}] Failed to send email to ${vehicle.assignedUserEmail}`,
            error,
          );
        }
      }
    }

    return { emailsSent: emailsSent.count, recipients, errors };
  }

  private formatServiceVehiclesForEmail(
    vehicles: VehicleServiceAlert[],
  ): VehicleServiceEmailItem[] {
    return vehicles.map((vehicle) => ({
      registrationNo: vehicle.registrationNo,
      vehicleNumber: vehicle.number,
      brand: vehicle.brand,
      model: vehicle.model,
      assignedTo: vehicle.assignedUserName || 'Unassigned',
      lastServiceKm: this.formatKm(vehicle.lastServiceKm),
      lastServiceDate: vehicle.lastServiceDate ? this.formatDate(vehicle.lastServiceDate) : 'N/A',
      currentOdometerKm: this.formatKm(vehicle.currentOdometerKm),
      nextServiceDueKm: this.formatKm(vehicle.nextServiceDueKm),
      kmStatus: this.getKmStatusText(vehicle.kmToNextService),
      statusClass: vehicle.status === ServiceDueAlertStatus.OVERDUE ? 'overdue' : 'due-soon',
    }));
  }

  private getServiceEmailSubject(overdueCount: number): string {
    if (overdueCount > 0) {
      return EMAIL_SUBJECT.VEHICLE_SERVICE_DUE_URGENT;
    }
    return EMAIL_SUBJECT.VEHICLE_SERVICE_DUE;
  }

  private getKmStatusText(kmToNextService: number): string {
    if (kmToNextService <= 0) {
      const overdueKm = Math.abs(kmToNextService);
      return `${this.formatKm(overdueKm)} overdue`;
    }
    return `${this.formatKm(kmToNextService)} to service`;
  }

  private formatKm(km: number): string {
    return km.toLocaleString('en-IN') + ' km';
  }

  private async getExpiryWarningDays(): Promise<number> {
    try {
      const configuration = await this.configurationService.findOne({
        where: {
          module: CONFIGURATION_MODULES.VEHICLE,
          key: CONFIGURATION_KEYS.VEHICLE_EXPIRING_SOON_DAYS,
        },
      });

      if (!configuration) {
        this.logger.warn('Vehicle document expiry warning days config not found, using default');
        return DEFAULT_EXPIRING_SOON_DAYS;
      }

      const configSetting = await this.configSettingService.findOne({
        where: { configId: configuration.id, isActive: true },
      });

      if (!configSetting?.value) {
        this.logger.warn('Vehicle document expiry warning days setting not found, using default');
        return DEFAULT_EXPIRING_SOON_DAYS;
      }

      return Number(configSetting.value);
    } catch {
      this.logger.warn('Error fetching vehicle expiry warning days, using default');
      return DEFAULT_EXPIRING_SOON_DAYS;
    }
  }

  private processVehicleDocuments(
    vehiclesRaw: any[],
    warningDays: number,
  ): {
    vehicleAlerts: VehicleDocumentAlert[];
    expiredCount: DocumentExpiryCount;
    expiringSoonCount: DocumentExpiryCount;
  } {
    const vehicleAlerts: VehicleDocumentAlert[] = [];
    const expiredCount = this.initDocumentCount();
    const expiringSoonCount = this.initDocumentCount();

    for (const vehicle of vehiclesRaw) {
      const documents: DocumentAlert[] = [];

      // Check Insurance
      if (
        vehicle.insuranceDaysRemaining !== null &&
        vehicle.insuranceDaysRemaining <= warningDays
      ) {
        const status = getDocumentAlertStatus(vehicle.insuranceDaysRemaining);
        documents.push({
          type: VehicleDocumentType.INSURANCE,
          label: getDocumentTypeLabel(VehicleDocumentType.INSURANCE),
          endDate: vehicle.insuranceEndDate,
          daysUntilExpiry: vehicle.insuranceDaysRemaining,
          status,
        });

        if (status === DocumentAlertStatus.EXPIRED) {
          expiredCount.insurance++;
          expiredCount.total++;
        } else {
          expiringSoonCount.insurance++;
          expiringSoonCount.total++;
        }
      }

      // Check PUC
      if (vehicle.pucDaysRemaining !== null && vehicle.pucDaysRemaining <= warningDays) {
        const status = getDocumentAlertStatus(vehicle.pucDaysRemaining);
        documents.push({
          type: VehicleDocumentType.PUC,
          label: getDocumentTypeLabel(VehicleDocumentType.PUC),
          endDate: vehicle.pucEndDate,
          daysUntilExpiry: vehicle.pucDaysRemaining,
          status,
        });

        if (status === DocumentAlertStatus.EXPIRED) {
          expiredCount.puc++;
          expiredCount.total++;
        } else {
          expiringSoonCount.puc++;
          expiringSoonCount.total++;
        }
      }

      // Check Fitness
      if (vehicle.fitnessDaysRemaining !== null && vehicle.fitnessDaysRemaining <= warningDays) {
        const status = getDocumentAlertStatus(vehicle.fitnessDaysRemaining);
        documents.push({
          type: VehicleDocumentType.FITNESS,
          label: getDocumentTypeLabel(VehicleDocumentType.FITNESS),
          endDate: vehicle.fitnessEndDate,
          daysUntilExpiry: vehicle.fitnessDaysRemaining,
          status,
        });

        if (status === DocumentAlertStatus.EXPIRED) {
          expiredCount.fitness++;
          expiredCount.total++;
        } else {
          expiringSoonCount.fitness++;
          expiringSoonCount.total++;
        }
      }

      if (documents.length > 0) {
        vehicleAlerts.push({
          vehicleId: vehicle.vehicleVersionId,
          vehicleMasterId: vehicle.vehicleMasterId,
          registrationNo: vehicle.registrationNo,
          number: vehicle.number,
          brand: vehicle.brand,
          model: vehicle.model,
          assignedTo: vehicle.assignedTo,
          assignedUserName: vehicle.assignedFirstName
            ? `${vehicle.assignedFirstName} ${vehicle.assignedLastName || ''}`.trim()
            : null,
          assignedUserEmail: vehicle.assignedUserEmail,
          documents,
        });
      }
    }

    return { vehicleAlerts, expiredCount, expiringSoonCount };
  }

  private async sendExpiryAlertEmails(
    expiredVehicles: VehicleDocumentAlert[],
    expiringSoonVehicles: VehicleDocumentAlert[],
    expiredCount: DocumentExpiryCount,
    expiringSoonCount: DocumentExpiryCount,
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

    const emailData: VehicleDocumentEmailData = {
      currentYear: new Date().getFullYear(),
      adminPortalUrl: Environments.FE_BASE_URL || '#',
      totalExpired: expiredCount.total,
      totalExpiringSoon: expiringSoonCount.total,
      expiredVehicles: this.formatVehiclesForEmail(expiredVehicles, DocumentAlertStatus.EXPIRED),
      expiringSoonVehicles: this.formatVehiclesForEmail(
        expiringSoonVehicles,
        DocumentAlertStatus.EXPIRING_SOON,
      ),
      hasExpired: expiredCount.total > 0,
      hasExpiringSoon: expiringSoonCount.total > 0,
    };

    // Send to fleet managers
    for (const email of recipientEmails) {
      try {
        await this.emailService.sendMail({
          receiverEmails: email,
          subject: this.getEmailSubject(expiredCount.total),
          template: EMAIL_TEMPLATE.VEHICLE_DOCUMENT_EXPIRY,
          emailData,
        });

        this.logger.log(`[${cronName}] Email sent to fleet manager: ${email}`);
        recipients.push(email);
        emailsSent.count++;
      } catch (error) {
        errors.push(`Failed to send email to ${email}: ${error.message}`);
        this.logger.error(`[${cronName}] Failed to send email to ${email}`, error);
      }
    }

    // Send individual alerts to assigned users (only for their vehicles)
    const assignedUserEmails = new Set<string>();
    const allVehicles = [...expiredVehicles, ...expiringSoonVehicles];

    for (const vehicle of allVehicles) {
      if (vehicle.assignedUserEmail && !assignedUserEmails.has(vehicle.assignedUserEmail)) {
        assignedUserEmails.add(vehicle.assignedUserEmail);

        // Filter vehicles for this user
        const userVehicles = allVehicles.filter(
          (userVehicle: VehicleDocumentAlert) =>
            userVehicle.assignedUserEmail === vehicle.assignedUserEmail,
        );

        const userExpiredVehicles = userVehicles.filter((userVehicle: VehicleDocumentAlert) =>
          userVehicle.documents.some(
            (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRED,
          ),
        );
        const userExpiringSoonVehicles = userVehicles.filter(
          (userVehicle: VehicleDocumentAlert) =>
            !userVehicle.documents.some(
              (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRED,
            ) &&
            userVehicle.documents.some(
              (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRING_SOON,
            ),
        );

        const userExpiredCount = userExpiredVehicles.reduce(
          (acc, userVehicle: VehicleDocumentAlert) =>
            acc +
            userVehicle.documents.filter(
              (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRED,
            ).length,
          0,
        );
        const userExpiringSoonCount = userExpiringSoonVehicles.reduce(
          (acc, userVehicle: VehicleDocumentAlert) =>
            acc +
            userVehicle.documents.filter(
              (document: DocumentAlert) => document.status === DocumentAlertStatus.EXPIRING_SOON,
            ).length,
          0,
        );

        const userEmailData: VehicleDocumentEmailData = {
          currentYear: new Date().getFullYear(),
          adminPortalUrl: Environments.FE_BASE_URL || '#',
          totalExpired: userExpiredCount,
          totalExpiringSoon: userExpiringSoonCount,
          expiredVehicles: this.formatVehiclesForEmail(
            userExpiredVehicles,
            DocumentAlertStatus.EXPIRED,
          ),
          expiringSoonVehicles: this.formatVehiclesForEmail(
            userExpiringSoonVehicles,
            DocumentAlertStatus.EXPIRING_SOON,
          ),
          hasExpired: userExpiredCount > 0,
          hasExpiringSoon: userExpiringSoonCount > 0,
        };

        try {
          await this.emailService.sendMail({
            receiverEmails: vehicle.assignedUserEmail,
            subject: this.getEmailSubject(userExpiredCount),
            template: EMAIL_TEMPLATE.VEHICLE_DOCUMENT_EXPIRY,
            emailData: userEmailData,
          });

          this.logger.log(
            `[${cronName}] Email sent to assigned user: ${vehicle.assignedUserEmail}`,
          );
          recipients.push(vehicle.assignedUserEmail);
          emailsSent.count++;
        } catch (error) {
          errors.push(`Failed to send email to ${vehicle.assignedUserEmail}: ${error.message}`);
          this.logger.error(
            `[${cronName}] Failed to send email to ${vehicle.assignedUserEmail}`,
            error,
          );
        }
      }
    }

    return { emailsSent: emailsSent.count, recipients, errors };
  }

  private formatVehiclesForEmail(
    vehicles: VehicleDocumentAlert[],
    filterStatus: DocumentAlertStatus,
  ): VehicleDocumentEmailItem[] {
    return vehicles.map((vehicle) => ({
      registrationNo: vehicle.registrationNo,
      vehicleNumber: vehicle.number,
      brand: vehicle.brand,
      model: vehicle.model,
      assignedTo: vehicle.assignedUserName || 'Unassigned',
      documents: vehicle.documents
        .filter((d) => d.status === filterStatus)
        .map((doc) => ({
          type: doc.type,
          label: doc.label,
          endDate: this.formatDate(doc.endDate),
          daysText: this.getDaysText(doc.daysUntilExpiry),
          statusClass: doc.status === DocumentAlertStatus.EXPIRED ? 'expired' : 'expiring-soon',
        })),
    }));
  }

  private getEmailSubject(expiredCount: number): string {
    if (expiredCount > 0) {
      return EMAIL_SUBJECT.VEHICLE_DOCUMENT_EXPIRY_URGENT;
    }
    return EMAIL_SUBJECT.VEHICLE_DOCUMENT_EXPIRY;
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

  private initDocumentCount(): DocumentExpiryCount {
    return { insurance: 0, puc: 0, fitness: 0, total: 0 };
  }

  /**
   * TODO: Fetch dynamically from user roles (ADMIN)
   */
  private async getRecipientEmails(): Promise<string[]> {
    // TODO: Implement dynamic fetching from user roles
    // const users = await this.userService.findByRole(['ADMIN']);
    // return users.map(u => u.email).filter(Boolean);
    return ['akhil.sachan@coditas.com']; // Placeholder
  }
}
