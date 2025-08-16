import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import { CardsEntity } from './entities/card.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [TypeOrmModule.forFeature([CardsEntity]), SharedModule],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, UtilityService],
  exports: [CardsService],
})
export class CardsModule {}
