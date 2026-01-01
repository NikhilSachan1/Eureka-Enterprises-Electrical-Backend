import { Module, forwardRef } from '@nestjs/common';
import { VehicleMastersService } from './vehicle-masters.service';
import { VehicleMastersController } from './vehicle-masters.controller';
import { VehicleMastersRepository } from './vehicle-masters.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleMasterEntity } from './entities/vehicle-master.entity';
import { VehicleFilesModule } from '../vehicle-files/vehicle-files.module';
import { VehicleEventsModule } from '../vehicle-events/vehicle-events.module';
import { VehicleVersionsModule } from '../vehicle-versions/vehicle-versions.module';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';
import { CardsModule } from '../cards/cards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleMasterEntity]),
    VehicleFilesModule,
    VehicleEventsModule,
    VehicleVersionsModule,
    SharedModule,
    ConfigurationsModule,
    forwardRef(() => CardsModule),
  ],
  controllers: [VehicleMastersController],
  providers: [VehicleMastersService, VehicleMastersRepository],
  exports: [VehicleMastersService],
})
export class VehicleMastersModule {}
