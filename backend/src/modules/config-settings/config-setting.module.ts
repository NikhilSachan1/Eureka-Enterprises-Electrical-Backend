import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigSettingService } from './config-setting.service';
import { ConfigSettingController } from './config-setting.controller';
import { ConfigSettingRepository } from './config-setting.repository';
import { ConfigSettingEntity } from './entities/config-setting.entity';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { UtilityService } from '../../utils/utility/utility.service';
import { SharedModule } from '../../modules/shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigSettingEntity]), ConfigurationsModule, SharedModule],
  providers: [ConfigSettingService, ConfigSettingRepository, UtilityService],
  exports: [ConfigSettingService],
  controllers: [ConfigSettingController],
})
export class ConfigSettingsModule {}
