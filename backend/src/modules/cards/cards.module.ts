import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import { CardsEntity } from './entities/card.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CardsEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
  ],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, UtilityService],
  exports: [CardsService],
})
export class CardsModule {}
