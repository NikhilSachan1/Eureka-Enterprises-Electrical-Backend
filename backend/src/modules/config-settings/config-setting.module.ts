import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigSettingService } from './config-setting.service';
import { ConfigSettingController } from './config-setting.controller';
import { ConfigSettingRepository } from './config-setting.repository';
import { ConfigSettingEntity } from './entities/config-setting.entity';
import { ConfigurationsModule } from '../configurations/configuration.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConfigSettingEntity]), ConfigurationsModule],
  providers: [ConfigSettingService, ConfigSettingRepository],
  exports: [ConfigSettingService],
  controllers: [ConfigSettingController],
})
export class ConfigSettingsModule {}
