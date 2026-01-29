import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DsrController } from './dsr.controller';
import { DsrService } from './dsr.service';
import { DsrRepository } from './dsr.repository';
import { DailyStatusReportEntity, DsrFileEntity, DsrEditHistoryEntity } from './entities';
import { SharedModule } from '../shared/shared.module';
import { SiteModule } from '../sites/site.module';
import { SiteAllocationModule } from '../site-allocations/site-allocation.module';
import { AssetVersionsModule } from '../asset-versions/asset-versions.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyStatusReportEntity, DsrFileEntity, DsrEditHistoryEntity]),
    SharedModule,
    SiteModule,
    SiteAllocationModule,
    AssetVersionsModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [DsrController],
  providers: [DsrService, DsrRepository],
  exports: [DsrService, DsrRepository],
})
export class DsrModule {}
