import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionService } from './permission.service';
import { PermissionController } from './permission.controller';
import { PermissionRepository } from './permission.repository';
import { PermissionEntity } from './entities/permission.entity';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PermissionEntity]),
    ConfigSettingsModule,
    ConfigurationsModule,
    SharedModule,
  ],
  providers: [PermissionService, PermissionRepository, UtilityService],
  exports: [PermissionService],
  controllers: [PermissionController],
})
export class PermissionsModule {}
