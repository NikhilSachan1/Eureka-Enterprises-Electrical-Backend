import { Module } from '@nestjs/common';
import { VehicleFilesService } from './vehicle-files.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleFileEntity } from './entities/vehicle-file.entity';
import { VehicleFilesRepository } from './vehicle-files.repository';
import { SharedModule } from '../shared/shared.module';
// import { VehicleFilesController } from './vehicle-files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleFileEntity]), SharedModule],
  // controllers: [VehicleFilesController],
  providers: [VehicleFilesService, VehicleFilesRepository],
  exports: [VehicleFilesService],
})
export class VehicleFilesModule {}
