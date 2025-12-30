import { Module, forwardRef } from '@nestjs/common';
import { VehicleEventsService } from './vehicle-events.service';
import { VehicleEventsController } from './vehicle-events.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEventEntity } from './entities/vehicle-event.entity';
import { VehicleEventsRepository } from './vehicle-events.repository';
import { SharedModule } from '../shared/shared.module';
import { VehicleFilesModule } from '../vehicle-files/vehicle-files.module';
import { VehicleVersionsModule } from '../vehicle-versions/vehicle-versions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleEventEntity]),
    SharedModule,
    VehicleFilesModule,
    forwardRef(() => VehicleVersionsModule),
  ],
  controllers: [VehicleEventsController],
  providers: [VehicleEventsService, VehicleEventsRepository],
  exports: [VehicleEventsService],
})
export class VehicleEventsModule {}
