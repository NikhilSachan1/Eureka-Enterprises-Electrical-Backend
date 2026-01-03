import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehicleVersionDto } from './dto/create-vehicle.dto';
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
    createVehicleDto: Partial<CreateVehicleVersionDto> & {
      vehicleMasterId: string;
      registrationNo: string;
      brand: string;
      model: string;
      mileage: string;
      createdBy: string;
    },
    entityManager?: EntityManager,
  ) {
    try {
      const { createdBy, vehicleMasterId } = createVehicleDto;

      // Deactivate previous active version for this vehicle master
      await this.update(
        { vehicleMasterId, isActive: true },
        { isActive: false, updatedBy: createdBy },
        entityManager,
      );

      // Convert date strings to Date objects for entity compatibility
      const entityData: Partial<VehicleVersionEntity> = {
        ...createVehicleDto,
        isActive: true,
        createdBy,
        purchaseDate: createVehicleDto.purchaseDate
          ? new Date(createVehicleDto.purchaseDate)
          : undefined,
        insuranceStartDate: createVehicleDto.insuranceStartDate
          ? new Date(createVehicleDto.insuranceStartDate)
          : undefined,
        insuranceEndDate: createVehicleDto.insuranceEndDate
          ? new Date(createVehicleDto.insuranceEndDate)
          : undefined,
        pucStartDate: createVehicleDto.pucStartDate
          ? new Date(createVehicleDto.pucStartDate)
          : undefined,
        pucEndDate: createVehicleDto.pucEndDate ? new Date(createVehicleDto.pucEndDate) : undefined,
        fitnessStartDate: createVehicleDto.fitnessStartDate
          ? new Date(createVehicleDto.fitnessStartDate)
          : undefined,
        fitnessEndDate: createVehicleDto.fitnessEndDate
          ? new Date(createVehicleDto.fitnessEndDate)
          : undefined,
      };

      return await this.vehicleVersionsRepository.create(entityData, entityManager);
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
