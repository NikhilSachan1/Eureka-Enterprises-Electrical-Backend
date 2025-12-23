import { Injectable } from '@nestjs/common';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
import { VehicleServiceFilesRepository } from './vehicle-service-files.repository';
import { VehicleServiceFileEntity } from './entities/vehicle-service-file.entity';
import { CreateVehicleServiceFileDto } from './dto/create-vehicle-service-file.dto';

@Injectable()
export class VehicleServiceFilesService {
  constructor(private readonly vehicleServiceFilesRepository: VehicleServiceFilesRepository) {}

  async create(
    createDto: CreateVehicleServiceFileDto & { createdBy: string },
    entityManager?: EntityManager,
  ): Promise<boolean> {
    const { vehicleServiceId, fileKeys, fileType, label, createdBy } = createDto;

    if (fileKeys && fileKeys.length > 0) {
      for (const fileKey of fileKeys) {
        await this.vehicleServiceFilesRepository.create(
          {
            vehicleServiceId,
            fileType,
            fileKey,
            label,
            createdBy,
            updatedBy: createdBy,
          },
          entityManager,
        );
      }
    }

    return true;
  }

  async findOne(
    options: FindOneOptions<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceFileEntity | null> {
    return await this.vehicleServiceFilesRepository.findOne(options, entityManager);
  }

  async findAll(
    options: FindManyOptions<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceFileEntity[]> {
    return await this.vehicleServiceFilesRepository.findAll(options, entityManager);
  }
}
