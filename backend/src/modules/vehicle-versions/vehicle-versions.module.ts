import { Module, forwardRef } from '@nestjs/common';
import { VehicleVersionsService } from './vehicle-versions.service';
import { VehicleFilesModule } from '../vehicle-files/vehicle-files.module';
import { VehicleEventsModule } from '../vehicle-events/vehicle-events.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleVersionEntity } from './entities/vehicle-versions.entity';
import { VehicleVersionsRepository } from './vehicle-versions.repository';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleVersionEntity]),
    VehicleFilesModule,
    forwardRef(() => VehicleEventsModule),
    SharedModule,
  ],
  providers: [VehicleVersionsService, VehicleVersionsRepository],
  exports: [VehicleVersionsService],
})
export class VehicleVersionsModule {}
