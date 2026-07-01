import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSheetEntity } from './entities/payment-sheet.entity';
import { PaymentSheetItemEntity } from './entities/payment-sheet-item.entity';
import { PaymentSheetItemBookPaymentEntity } from './entities/payment-sheet-item-book-payment.entity';
import { PaymentSheetItemHistoryEntity } from './entities/payment-sheet-item-history.entity';
import { PaymentSheetStageLogEntity } from './entities/payment-sheet-stage-log.entity';
import { PaymentSheetItemVerificationEntity } from './entities/payment-sheet-item-verification.entity';
import { PaymentSheetRepository } from './payment-sheet.repository';
import { PaymentSheetService } from './payment-sheet.service';
import { PaymentSheetPdfService } from './payment-sheet-pdf.service';
import { PaymentSheetController } from './payment-sheet.controller';
import { ExpenseTrackerModule } from 'src/modules/expense-tracker/expense-tracker.module';
import { FuelExpenseModule } from 'src/modules/fuel-expense/fuel-expense.module';
import { BankTransferModule } from 'src/modules/bank-transfers/bank-transfer.module';
import { EmailModule } from 'src/modules/common/email/email.module';
import { FilesModule } from 'src/modules/common/file-upload/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentSheetEntity,
      PaymentSheetItemEntity,
      PaymentSheetItemBookPaymentEntity,
      PaymentSheetItemHistoryEntity,
      PaymentSheetStageLogEntity,
      PaymentSheetItemVerificationEntity,
    ]),
    ExpenseTrackerModule,
    FuelExpenseModule,
    BankTransferModule,
    EmailModule,
    FilesModule,
  ],
  controllers: [PaymentSheetController],
  providers: [PaymentSheetRepository, PaymentSheetService, PaymentSheetPdfService],
  exports: [PaymentSheetService],
})
export class PaymentSheetModule {}
