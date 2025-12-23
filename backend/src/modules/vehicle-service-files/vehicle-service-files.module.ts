import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleServiceFileEntity } from './entities/vehicle-service-file.entity';
import { VehicleServiceFilesRepository } from './vehicle-service-files.repository';
import { VehicleServiceFilesService } from './vehicle-service-files.service';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleServiceFileEntity])],
  providers: [VehicleServiceFilesRepository, VehicleServiceFilesService],
  exports: [VehicleServiceFilesService],
})
export class VehicleServiceFilesModule {}
