import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancePaymentEntity } from './entities/advance-payment.entity';
import { AdvanceSettlementEntity } from './entities/advance-settlement.entity';
import { AdvancePaymentController } from './advance-payment.controller';
import { AdvancePaymentService } from './advance-payment.service';
import { AdvancePaymentRepository } from './advance-payment.repository';
import { PurchaseOrderModule } from '../purchase-orders/purchase-order.module';
import { BookPaymentModule } from '../book-payments/book-payment.module';

@Module({
  // PurchaseOrderModule for the advancePaidTotal rollup. PO does not import this module back, so
  // there is no cycle; site-invoices imports both.
  imports: [
    TypeOrmModule.forFeature([AdvancePaymentEntity, AdvanceSettlementEntity]),
    PurchaseOrderModule,
    // Approval raises the advance's book payment. No cycle: book-payments does not import this.
    BookPaymentModule,
  ],
  controllers: [AdvancePaymentController],
  providers: [AdvancePaymentService, AdvancePaymentRepository],
  // Exported so site-invoices can run settlement on approval (phase 3) without importing the
  // controller layer.
  exports: [AdvancePaymentService, AdvancePaymentRepository],
})
export class AdvancePaymentModule {}
