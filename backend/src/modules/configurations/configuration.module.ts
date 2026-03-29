import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationService } from './configuration.service';
import { ConfigurationController } from './configuration.controller';
import { ConfigurationRepository } from './configuration.repository';
import { ConfigurationEntity } from './entities/configuration.entity';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SharedModule } from '../shared/shared.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfigurationEntity]),
    SharedModule,
    forwardRef(() => ConfigSettingsModule),
  ],
  providers: [ConfigurationService, ConfigurationRepository, UtilityService],
  exports: [ConfigurationService],
  controllers: [ConfigurationController],
})
export class ConfigurationsModule {}
