import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteInvoiceController } from './site-invoice.controller';
import { SiteInvoiceService } from './site-invoice.service';
import { SiteInvoiceRepository } from './site-invoice.repository';
import { SiteInvoiceEntity } from './entities/site-invoice.entity';
import { PurchaseOrderModule } from '../purchase-orders/purchase-order.module';

@Module({
  imports: [TypeOrmModule.forFeature([SiteInvoiceEntity]), PurchaseOrderModule],
  controllers: [SiteInvoiceController],
  providers: [SiteInvoiceService, SiteInvoiceRepository],
  exports: [SiteInvoiceService, SiteInvoiceRepository],
})
export class SiteInvoiceModule {}
