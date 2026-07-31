import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRequestController } from './payment-request.controller';
import { PaymentRequestService } from './payment-request.service';
import { PaymentRequestEntity } from './entities/payment-request.entity';
import { BookPaymentModule } from '../book-payments/book-payment.module';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentRequestEntity]), BookPaymentModule],
  controllers: [PaymentRequestController],
  providers: [PaymentRequestService],
  exports: [PaymentRequestService],
})
export class PaymentRequestModule {}
