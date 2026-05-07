import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TdsRegisterEntryEntity } from './entities/tds-register-entry.entity';
import { TdsPaymentEntity } from './entities/tds-payment.entity';
import { TdsRepository } from './tds.repository';
import { TdsService } from './tds.service';
import { TdsController } from './tds.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TdsRegisterEntryEntity, TdsPaymentEntity]),
  ],
  controllers: [TdsController],
  providers: [TdsRepository, TdsService],
  exports: [TdsRepository, TdsService],
})
export class TdsModule {}
