import { Injectable } from '@nestjs/common';
import { VehicleFilesRepository } from './vehicle-files.repository';
import { CreateVehicleFileDto } from './dto/create-vehicle-file.dto';
import { EntityManager } from 'typeorm';

@Injectable()
export class VehicleFilesService {
  constructor(private readonly vehicleFilesRepository: VehicleFilesRepository) {}

  async create(
    createVehicleFileDto: CreateVehicleFileDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { vehicleId, fileType, fileKeys, createdBy, vehicleEventsId } = createVehicleFileDto;
      if (fileKeys) {
        for (const fileKey of fileKeys) {
          await this.vehicleFilesRepository.create(
            {
              vehicleId,
              fileType,
              fileKey,
              createdBy,
              vehicleEventsId,
              updatedBy: createdBy,
            },
            entityManager,
          );
        }
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}
