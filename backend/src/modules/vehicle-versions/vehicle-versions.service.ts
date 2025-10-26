import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehicleDto } from './dto';
import { VehicleVersionsRepository } from './vehicle-versions.repository';
import { VehicleVersionEntity } from './entities/vehicle-versions.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  VEHICLE_VERSION_ERRORS,
  VehicleVersionEntityFields,
} from './constants/vehicle-versions.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class VehicleVersionsService {
  constructor(
    private readonly vehicleVersionsRepository: VehicleVersionsRepository,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createVehicleDto: CreateVehicleDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { createdBy, number, vehicleMasterId } = createVehicleDto;
      await this.update({ number, vehicleMasterId }, { isActive: false, updatedBy: createdBy });
      return await this.vehicleVersionsRepository.create(
        { ...createVehicleDto, createdBy },
        entityManager,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<VehicleVersionEntity>) {
    try {
      return await this.vehicleVersionsRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: FindManyOptions<VehicleVersionEntity>) {
    try {
      return await this.vehicleVersionsRepository.findAll(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<VehicleVersionEntity>) {
    try {
      const vehicle = await this.vehicleVersionsRepository.findOne(findOptions);
      if (!vehicle) {
        throw new NotFoundException(VEHICLE_VERSION_ERRORS.VEHICLE_NOT_FOUND);
      }
      return vehicle;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleVersionEntity>,
    updateData: Partial<VehicleVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.vehicleVersionsRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        VehicleVersionEntityFields.VEHICLE,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleVersionEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.vehicleVersionsRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        VehicleVersionEntityFields.VEHICLE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
