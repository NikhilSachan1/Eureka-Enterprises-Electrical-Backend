import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteInvoiceController } from './site-invoice.controller';
import { SiteInvoiceService } from './site-invoice.service';
import { SiteInvoiceRepository } from './site-invoice.repository';
import { SiteInvoiceEntity } from './entities/site-invoice.entity';
import { PurchaseOrderModule } from '../purchase-orders/purchase-order.module';
import { AdvancePaymentModule } from '../advance-payments/advance-payment.module';

@Module({
  // AdvancePaymentModule for settlement on approval — it exports AdvancePaymentRepository for
  // exactly this, and does not import site-invoices back, so there is no cycle.
  imports: [
    TypeOrmModule.forFeature([SiteInvoiceEntity]),
    PurchaseOrderModule,
    AdvancePaymentModule,
  ],
  controllers: [SiteInvoiceController],
  providers: [SiteInvoiceService, SiteInvoiceRepository],
  exports: [SiteInvoiceService, SiteInvoiceRepository],
})
export class SiteInvoiceModule {}
