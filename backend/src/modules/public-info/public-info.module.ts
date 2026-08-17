import { Module } from '@nestjs/common';
import { PublicInfoController } from './public-info.controller';
import { PublicInfoService } from './public-info.service';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [ConfigurationsModule, ConfigSettingsModule],
  controllers: [PublicInfoController],
  providers: [PublicInfoService],
})
export class PublicInfoModule {}
