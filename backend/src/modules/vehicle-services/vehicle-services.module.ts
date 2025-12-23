import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleServiceEntity } from './entities/vehicle-service.entity';
import { VehicleServicesRepository } from './vehicle-services.repository';
import { VehicleServicesService } from './vehicle-services.service';
import { VehicleServicesController } from './vehicle-services.controller';
import { VehicleMastersModule } from '../vehicle-masters/vehicle-masters.module';
import { VehicleVersionsModule } from '../vehicle-versions/vehicle-versions.module';
import { VehicleServiceFilesModule } from '../vehicle-service-files/vehicle-service-files.module';
import { SharedModule } from '../shared/shared.module';
import { ConfigurationsModule } from '../configurations/configuration.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleServiceEntity]),
    VehicleMastersModule,
    VehicleVersionsModule,
    VehicleServiceFilesModule,
    SharedModule,
    ConfigurationsModule,
  ],
  controllers: [VehicleServicesController],
  providers: [VehicleServicesRepository, VehicleServicesService],
  exports: [VehicleServicesService],
})
export class VehicleServicesModule {}
