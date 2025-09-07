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
import { VehicleEntity } from 'src/modules/vehicles/entities/vehicle.entity';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';

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
        VehicleEntity,
        VehicleFileEntity,
        VehicleEventEntity,
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
