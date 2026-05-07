import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteDocumentController } from './site-document.controller';
import { SiteDocumentService } from './site-document.service';
import { SiteDocumentRepository } from './site-document.repository';
import { SiteDocumentEntity } from './entities/site-document.entity';
import { SharedModule } from '../shared/shared.module';
import { SiteModule } from '../sites/site.module';
import { ContractorModule } from '../contractors/contractor.module';
import { VendorModule } from '../vendors/vendor.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

/**
 * Site Document Module - Repurposed for non-financial documents only.
 * 
 * Financial documents (PO, INVOICE) have been moved to dedicated modules:
 * - PurchaseOrderModule, SiteInvoiceModule, BankTransferModule, etc.
 * 
 * This module now handles miscellaneous site documents like:
 * - Contracts, work orders, completion certificates
 * - Photos, inspection reports, etc.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SiteDocumentEntity]),
    SharedModule,
    forwardRef(() => SiteModule),
    forwardRef(() => ContractorModule),
    forwardRef(() => VendorModule),
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [SiteDocumentController],
  providers: [SiteDocumentService, SiteDocumentRepository],
  exports: [SiteDocumentService, SiteDocumentRepository],
})
export class SiteDocumentModule {}
