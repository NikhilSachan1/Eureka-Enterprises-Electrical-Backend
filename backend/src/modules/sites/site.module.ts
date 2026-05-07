import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { SiteRepository } from './site.repository';
import { SiteEntity } from './entities/site.entity';
import { SiteContractorEntity } from './entities/site-contractor.entity';
import { SiteStatusHistoryEntity } from './entities/site-status-history.entity';
import { SharedModule } from '../shared/shared.module';
import { CompanyModule } from '../companies/company.module';
import { ContractorModule } from '../contractors/contractor.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteEntity, SiteContractorEntity, SiteStatusHistoryEntity]),
    SharedModule,
    CompanyModule,
    ContractorModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    BillingModule,
  ],
  controllers: [SiteController],
  providers: [SiteService, SiteRepository],
  exports: [SiteService, SiteRepository],
})
export class SiteModule {}
