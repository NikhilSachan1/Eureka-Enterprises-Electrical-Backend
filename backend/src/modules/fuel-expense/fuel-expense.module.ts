import { Module } from '@nestjs/common';
import { FuelExpenseService } from './fuel-expense.service';
import { FuelExpenseController } from './fuel-expense.controller';
import { FuelExpenseRepository } from './fuel-expense.repository';
import { FuelExpenseEntity } from './entities/fuel-expense.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { FuelExpenseFilesModule } from '../fuel-expense-files/fuel-expense-files.module';
import { VehicleMastersModule } from '../vehicle-masters/vehicle-masters.module';
import { CardsModule } from '../cards/cards.module';
import { UsersModule } from '../users/user.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { ConfigSettingsModule } from '../config-settings/config-setting.module';
import { DateTimeModule } from 'src/utils/datetime';

@Module({
  imports: [
    TypeOrmModule.forFeature([FuelExpenseEntity]),
    SharedModule,
    FuelExpenseFilesModule,
    VehicleMastersModule,
    CardsModule,
    UsersModule,
    ConfigurationsModule,
    ConfigSettingsModule,
    DateTimeModule,
    SharedModule,
  ],
  controllers: [FuelExpenseController],
  providers: [FuelExpenseService, FuelExpenseRepository],
  exports: [FuelExpenseService],
})
export class FuelExpenseModule {}
