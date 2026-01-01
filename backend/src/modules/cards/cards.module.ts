import { Module, forwardRef } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsController } from './cards.controller';
import { CardsRepository } from './cards.repository';
import { UtilityService } from 'src/utils/utility/utility.service';
import { CardsEntity } from './entities/card.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { FuelExpenseModule } from '../fuel-expense/fuel-expense.module';
import { VehicleMastersModule } from '../vehicle-masters/vehicle-masters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CardsEntity]),
    SharedModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    forwardRef(() => FuelExpenseModule),
    forwardRef(() => VehicleMastersModule),
  ],
  controllers: [CardsController],
  providers: [CardsService, CardsRepository, UtilityService],
  exports: [CardsService],
})
export class CardsModule {}
