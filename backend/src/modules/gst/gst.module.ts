import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GstRegisterEntryEntity } from './entities/gst-register-entry.entity';
import { GstPaymentEntity } from './entities/gst-payment.entity';
import { GstPaymentAdviceSequenceEntity } from './entities/gst-payment-advice-sequence.entity';
import { GstRepository } from './gst.repository';
import { GstService } from './gst.service';
import { GstController } from './gst.controller';
import { BookPaymentModule } from 'src/modules/book-payments/book-payment.module';
import { BankTransferModule } from 'src/modules/bank-transfers/bank-transfer.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GstRegisterEntryEntity,
      GstPaymentEntity,
      GstPaymentAdviceSequenceEntity,
    ]),
    // Held GST is settled through the normal payment chain (book payment → bank transfer).
    BookPaymentModule,
    BankTransferModule,
  ],
  controllers: [GstController],
  providers: [GstRepository, GstService],
  exports: [GstRepository, GstService],
})
export class GstModule {}
