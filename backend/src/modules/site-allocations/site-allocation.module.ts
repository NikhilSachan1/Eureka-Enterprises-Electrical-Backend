import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteAllocationController } from './site-allocation.controller';
import { SiteAllocationService } from './site-allocation.service';
import { SiteAllocationRepository } from './site-allocation.repository';
import { SiteAllocationEntity } from './entities/site-allocation.entity';
import { SharedModule } from '../shared/shared.module';
import { SiteModule } from '../sites/site.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteAllocationEntity]),
    SharedModule,
    SiteModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [SiteAllocationController],
  providers: [SiteAllocationService, SiteAllocationRepository],
  exports: [SiteAllocationService, SiteAllocationRepository],
})
export class SiteAllocationModule {}
