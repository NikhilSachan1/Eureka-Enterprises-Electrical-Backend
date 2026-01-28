import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteDocumentController } from './site-document.controller';
import { SiteDocumentService } from './site-document.service';
import { SiteDocumentRepository } from './site-document.repository';
import { SiteDocumentEntity } from './entities/site-document.entity';
import { SharedModule } from '../shared/shared.module';
import { SiteModule } from '../sites/site.module';
import { ContractorModule } from '../contractors/contractor.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SiteDocumentEntity]),
    SharedModule,
    SiteModule,
    ContractorModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [SiteDocumentController],
  providers: [SiteDocumentService, SiteDocumentRepository],
  exports: [SiteDocumentService, SiteDocumentRepository],
})
export class SiteDocumentModule {}
