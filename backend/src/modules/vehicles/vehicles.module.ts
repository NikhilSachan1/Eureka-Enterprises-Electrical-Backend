import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { VehicleFilesModule } from '../vehicle-files/vehicle-files.module';
import { VehicleEventsModule } from '../vehicle-events/vehicle-events.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from './entities/vehicle.entity';
import { VehiclesRepository } from './vehicles.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEntity]),
    VehicleFilesModule,
    VehicleEventsModule,
    SharedModule,
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesRepository],
  exports: [VehiclesService],
})
export class VehiclesModule {}
