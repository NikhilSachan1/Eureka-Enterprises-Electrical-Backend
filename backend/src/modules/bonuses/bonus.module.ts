import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BonusEntity } from './entities/bonus.entity';
import { BonusController } from './bonus.controller';
import { BonusService } from './bonus.service';
import { BonusRepository } from './bonus.repository';
import { SharedModule } from '../shared/shared.module';
@Module({
  imports: [TypeOrmModule.forFeature([BonusEntity]), SharedModule],
  controllers: [BonusController],
  providers: [BonusService, BonusRepository],
  exports: [BonusService, BonusRepository],
})
export class BonusModule {}
