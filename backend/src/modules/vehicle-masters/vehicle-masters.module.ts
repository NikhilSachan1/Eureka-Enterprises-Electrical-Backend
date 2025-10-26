import { Module } from '@nestjs/common';
import { VehicleMastersService } from './vehicle-masters.service';
import { VehicleMastersRepository } from './vehicle-masters.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleMasterEntity } from './entities/vehicle-master.entity';
import { VehicleFilesModule } from '../vehicle-files/vehicle-files.module';
import { VehicleEventsModule } from '../vehicle-events/vehicle-events.module';
import { VehicleVersionsModule } from '../vehicle-versions/vehicle-versions.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleMasterEntity]),
    VehicleFilesModule,
    VehicleEventsModule,
    VehicleVersionsModule,
    SharedModule,
  ],
  providers: [VehicleMastersService, VehicleMastersRepository],
  exports: [VehicleMastersService],
})
export class VehicleMastersModule {}
