import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAdviceEntity } from './entities/payment-advice.entity';
import { PaymentAdviceSequenceEntity } from './entities/payment-advice-sequence.entity';
import { PaymentAdviceEmailLogEntity } from './entities/payment-advice-email-log.entity';
import { PaymentAdviceRepository } from './payment-advice.repository';
import { PaymentAdviceService } from './payment-advice.service';
import { PaymentAdvicePdfService } from './payment-advice-pdf.service';
import { PaymentAdviceController } from './payment-advice.controller';
import { EmailModule } from 'src/modules/common/email/email.module';
import { CommunicationLogModule } from 'src/modules/common/communication-logs/communication-log.module';
import { FilesModule } from 'src/modules/common/file-upload/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentAdviceEntity,
      PaymentAdviceSequenceEntity,
      PaymentAdviceEmailLogEntity,
    ]),
    EmailModule,
    CommunicationLogModule,
    FilesModule,
  ],
  controllers: [PaymentAdviceController],
  providers: [PaymentAdviceRepository, PaymentAdviceService, PaymentAdvicePdfService],
  exports: [PaymentAdviceRepository, PaymentAdviceService],
})
export class PaymentAdviceModule {}
