import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GstRegisterEntryEntity } from './entities/gst-register-entry.entity';
import { GstPaymentEntity } from './entities/gst-payment.entity';
import { GstPaymentAdviceSequenceEntity } from './entities/gst-payment-advice-sequence.entity';
import { GstRepository } from './gst.repository';
import { GstService } from './gst.service';
import { GstController } from './gst.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GstRegisterEntryEntity,
      GstPaymentEntity,
      GstPaymentAdviceSequenceEntity,
    ]),
  ],
  controllers: [GstController],
  providers: [GstRepository, GstService],
  exports: [GstRepository, GstService],
})
export class GstModule {}
