import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookPaymentEntity } from './entities/book-payment.entity';
import { BookPaymentRepository } from './book-payment.repository';
import { BookPaymentService } from './book-payment.service';
import { BookPaymentController } from './book-payment.controller';
import { PurchaseOrderModule } from 'src/modules/purchase-orders/purchase-order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BookPaymentEntity]),
    PurchaseOrderModule,
  ],
  controllers: [BookPaymentController],
  providers: [BookPaymentRepository, BookPaymentService],
  exports: [BookPaymentService], // Only export Service - other modules should use Service, not Repository
})
export class BookPaymentModule {}
