import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvancePaymentEntity } from './entities/advance-payment.entity';
import { AdvanceSettlementEntity } from './entities/advance-settlement.entity';
import { AdvancePaymentController } from './advance-payment.controller';
import { AdvancePaymentService } from './advance-payment.service';
import { AdvancePaymentRepository } from './advance-payment.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AdvancePaymentEntity, AdvanceSettlementEntity])],
  controllers: [AdvancePaymentController],
  providers: [AdvancePaymentService, AdvancePaymentRepository],
  // Exported so site-invoices can run settlement on approval (phase 3) without importing the
  // controller layer.
  exports: [AdvancePaymentService, AdvancePaymentRepository],
})
export class AdvancePaymentModule {}
