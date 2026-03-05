import * as path from 'path';
import { DataSourceOptions } from 'typeorm';
import { Environments } from '../../../env-configs';
import { ENVIRONMENT_CONFIG } from './constants/constants';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { RoleEntity } from 'src/modules/roles/entities/role.entity';
import { UserRoleEntity } from 'src/modules/user-roles/entities/user-role.entity';
import { ConfigSettingEntity } from 'src/modules/config-settings/entities/config-setting.entity';
import { ConfigurationEntity } from 'src/modules/configurations/entities/configuration.entity';
import { RolePermissionEntity } from 'src/modules/role-permissions/entities/role-permission.entity';
import { PermissionEntity } from 'src/modules/permissions/entities/permission.entity';
import { UserPermissionEntity } from 'src/modules/user-permissions/entities/user-permission.entity';
import { AttendanceEntity } from 'src/modules/attendance/entities/attendance.entity';
import { LeaveApplicationsEntity } from 'src/modules/leave-applications/entities/leave-application.entity';
import { LeaveBalanceEntity } from 'src/modules/leave-balances/entities/leave-balance.entity';
import { ExpenseTrackerEntity } from 'src/modules/expense-tracker/entities/expense-tracker.entity';
import { ExpenseFilesEntity } from 'src/modules/expense-files/entities/expense-files.entity';
import { CardsEntity } from 'src/modules/cards/entities/card.entity';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';
import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { VehicleVersionEntity } from 'src/modules/vehicle-versions/entities/vehicle-versions.entity';
import { UserDocumentEntity } from 'src/modules/user-documents/entities/user-document.entity';
import { FuelExpenseEntity } from 'src/modules/fuel-expense/entities/fuel-expense.entity';
import { FuelExpenseFilesEntity } from 'src/modules/fuel-expense-files/entities/fuel-expense-files.entity';
import { AssetMasterEntity } from 'src/modules/asset-masters/entities/asset-master.entity';
import { AssetVersionEntity } from 'src/modules/asset-versions/entities/asset-versions.entity';
import { AssetFileEntity } from 'src/modules/asset-files/entities/asset-file.entity';
import { AssetEventEntity } from 'src/modules/asset-events/entities/asset-event.entity';
import { AnnouncementEntity } from 'src/modules/announcements/entities/announcement.entity';
import { AnnouncementTargetEntity } from 'src/modules/announcements/entities/announcement-target.entity';
import { UserAnnouncementAckEntity } from 'src/modules/announcements/entities/user-announcement-ack.entity';
import { VehicleServiceEntity } from 'src/modules/vehicle-services/entities/vehicle-service.entity';
import { VehicleServiceFileEntity } from 'src/modules/vehicle-service-files/entities/vehicle-service-file.entity';
import { SalaryStructureEntity } from 'src/modules/salary-structures/entities/salary-structure.entity';
import { SalaryChangeLogEntity } from 'src/modules/salary-change-logs/entities/salary-change-log.entity';
import { BonusEntity } from 'src/modules/bonuses/entities/bonus.entity';
import { PayrollEntity } from 'src/modules/payroll/entities/payroll.entity';
import { CronLogEntity } from 'src/modules/cron-logs/entities/cron-log.entity';
import { RequestAuditLogEntity } from 'src/modules/audit-logs/entities/request-audit-log.entity';
import { EntityAuditLogEntity } from 'src/modules/audit-logs/entities/entity-audit-log.entity';
import { RefreshTokenEntity } from 'src/modules/auth/entities/refresh-token.entity';
import { CommunicationLogEntity } from 'src/modules/common/communication-logs/entities/communication-log.entity';
import { CompanyEntity } from 'src/modules/companies/entities/company.entity';
import { SiteAllocationEntity } from 'src/modules/site-allocations/entities/site-allocation.entity';
import { SiteDocumentEntity } from 'src/modules/site-documents/entities/site-document.entity';
import { VehicleLogEntity } from 'src/modules/vehicle-logs/entities/vehicle-log.entity';
import { VehicleLogFileEntity } from 'src/modules/vehicle-logs/entities/vehicle-log-file.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { SiteStatusHistoryEntity } from 'src/modules/sites/entities/site-status-history.entity';
import { SiteContractorEntity } from 'src/modules/sites/entities/site-contractor.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { DailyStatusReportEntity } from 'src/modules/daily-status-reports/entities/daily-status-report.entity';
import { DsrEditHistoryEntity } from 'src/modules/daily-status-reports/entities/dsr-edit-history.entity';
import { DsrFileEntity } from 'src/modules/daily-status-reports/entities/dsr-file.entity';
import { FnfEntity } from 'src/modules/fnf/entities/fnf.entity';

export class ConfigService {
  static getValue(key: string) {
    return process.env[key];
  }

  static getIntValue(key: string): number {
    return parseInt(this.getValue(key));
  }

  static isProduction() {
    return this.getValue(Environments.APP_ENVIRONMENT) === ENVIRONMENT_CONFIG.PRODUCTION;
  }

  static getOrmConfig(connectionName = 'default', migrationsRun = false): DataSourceOptions {
    const migrationDir = path.join(__dirname, '../../migration/*.{js,ts}');
    const config: DataSourceOptions = {
      name: connectionName,
      type: 'postgres',
      host: Environments.DATABASE_HOST,
      port: Environments.DATABASE_PORT,
      username: Environments.DATABASE_USERNAME,
      password: Environments.DATABASE_PASSWORD,
      database: Environments.DATABASE_NAME,
      logging: true,
      migrationsRun,
      // Connection pool settings for remote database stability
      extra: {
        max: 20, // Maximum connections in pool
        min: 5, // Minimum connections to keep
        idleTimeoutMillis: 30000, // Close idle connections after 30s
        connectionTimeoutMillis: 10000, // Timeout for new connections (10s)
        keepAlive: true, // Keep connections alive
        keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
      },
      entities: [
        UserEntity,
        RoleEntity,
        UserRoleEntity,
        ConfigurationEntity,
        ConfigSettingEntity,
        PermissionEntity,
        RolePermissionEntity,
        UserPermissionEntity,
        AttendanceEntity,
        LeaveApplicationsEntity,
        LeaveBalanceEntity,
        ExpenseTrackerEntity,
        ExpenseFilesEntity,
        CardsEntity,
        VehicleMasterEntity,
        VehicleVersionEntity,
        VehicleFileEntity,
        VehicleEventEntity,
        UserDocumentEntity,
        FuelExpenseEntity,
        FuelExpenseFilesEntity,
        AssetMasterEntity,
        AssetVersionEntity,
        AssetFileEntity,
        AssetEventEntity,
        AnnouncementEntity,
        AnnouncementTargetEntity,
        UserAnnouncementAckEntity,
        VehicleServiceEntity,
        VehicleServiceFileEntity,
        SalaryStructureEntity,
        SalaryChangeLogEntity,
        BonusEntity,
        PayrollEntity,
        CronLogEntity,
        RequestAuditLogEntity,
        EntityAuditLogEntity,
        RefreshTokenEntity,
        CommunicationLogEntity,
        CompanyEntity,
        SiteAllocationEntity,
        SiteDocumentEntity,
        VehicleLogEntity,
        VehicleLogFileEntity,
        SiteEntity,
        SiteStatusHistoryEntity,
        SiteContractorEntity,
        ContractorEntity,
        DailyStatusReportEntity,
        DsrEditHistoryEntity,
        DsrFileEntity,
        FnfEntity,
      ],
      migrations: [migrationDir],
      synchronize: false,
    };

    if (Environments.DATABASE_SSL) {
      (config as any).ssl = {
        rejectUnauthorized: false,
      };
    }

    return config;
  }
}
