import * as path from 'path';
import { DataSourceOptions } from 'typeorm';
import { Environments } from '../../../env-configs';
import { ENVIRONMENT_CONFIG } from './constants/constants';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { RoleEntity } from 'src/modules/roles/entities/role.entity';
import { UserRoleEntity } from 'src/modules/user_roles/entities/user_role.entity';

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
      entities: [UserEntity, RoleEntity, UserRoleEntity],
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
