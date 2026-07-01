import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankTransferEntity } from './entities/bank-transfer.entity';
import { BankTransferRepository } from './bank-transfer.repository';
import { BankTransferService } from './bank-transfer.service';
import { BankTransferController } from './bank-transfer.controller';
import { BookPaymentModule } from 'src/modules/book-payments/book-payment.module';
import { PurchaseOrderModule } from 'src/modules/purchase-orders/purchase-order.module';
import { PaymentAdviceModule } from 'src/modules/payment-advices/payment-advice.module';
import { CompanyBankAccountModule } from 'src/modules/company-bank-accounts/company-bank-account.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankTransferEntity]),
    BookPaymentModule,
    PurchaseOrderModule,
    forwardRef(() => PaymentAdviceModule),
    CompanyBankAccountModule,
  ],
  controllers: [BankTransferController],
  providers: [BankTransferRepository, BankTransferService],
  exports: [BankTransferService], // Only export Service - other modules should use Service, not Repository
})
export class BankTransferModule {}
