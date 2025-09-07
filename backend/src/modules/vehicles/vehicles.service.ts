import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehicleDto } from './dto';
import { VehiclesRepository } from './vehicles.repository';
import { VehicleEntity } from './entities/vehicle.entity';
import {
  DataSource,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';
import {
  DEFAULT_VEHICLE_FILE_TYPES,
  VEHICLE_ERRORS,
  VehicleEntityFields,
  VehicleEventTypes,
} from './constants/vehicle.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import { VehicleEventsService } from '../vehicle-events/vehicle-events.service';
import { VehicleActionDto } from './dto/vehicle-action.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehiclesRepository: VehiclesRepository,
    private readonly vehicleFilesService: VehicleFilesService,
    private readonly vehicleEventsService: VehicleEventsService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createVehicleDto: CreateVehicleDto & { createdBy: string }, vehicleFiles: string[]) {
    try {
      const { number, createdBy } = createVehicleDto;
      const vehicle = await this.findOne({ where: { number } });
      if (vehicle) {
        throw new ConflictException(VEHICLE_ERRORS.VEHICLE_ALREADY_EXISTS);
      }
      return await this.dataSource.transaction(async (entityManager) => {
        const vehicle = await this.vehiclesRepository.create(
          { ...createVehicleDto, createdBy },
          entityManager,
        );

        const vehicleAddedEvent = await this.vehicleEventsService.create(
          {
            vehicleId: vehicle.id,
            eventType: VehicleEventTypes.VEHICLE_ADDED,
            createdBy,
          },
          entityManager,
        );

        await this.vehicleEventsService.create(
          {
            vehicleId: vehicle.id,
            eventType: VehicleEventTypes.AVAILABLE,
            createdBy,
          },
          entityManager,
        );

        await this.vehicleFilesService.create(
          {
            vehicleId: vehicle.id,
            fileType: DEFAULT_VEHICLE_FILE_TYPES.VEHICLE_IMAGE_DOC,
            fileKeys: vehicleFiles,
            vehicleEventsId: vehicleAddedEvent.id,
            createdBy,
          },
          entityManager,
        );

        return vehicle;
      });
    } catch (error) {
      throw error;
    }
  }

  async action(
    vehicleActionDto: VehicleActionDto & { fromUserId: string },
    vehicleFiles: string[],
    createdBy: string,
  ) {
    try {
      return await this.vehicleEventsService.action(vehicleActionDto, vehicleFiles, createdBy);
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<VehicleEntity>) {
    try {
      return await this.vehiclesRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: FindManyOptions<VehicleEntity>) {
    try {
      return await this.vehiclesRepository.findAll(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<VehicleEntity>) {
    try {
      const vehicle = await this.vehiclesRepository.findOne(findOptions);
      if (!vehicle) {
        throw new NotFoundException(VEHICLE_ERRORS.VEHICLE_NOT_FOUND);
      }
      return vehicle;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleEntity>,
    updateData: Partial<VehicleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const vehicle = await this.findOneOrFail({ where: identifierConditions });
      if (vehicle.number === updateData.number) {
        throw new ConflictException(VEHICLE_ERRORS.VEHICLE_ALREADY_EXISTS);
      }
      await this.vehiclesRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        VehicleEntityFields.VEHICLE,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.vehiclesRepository.delete({ ...identifierConditions, deletedBy }, entityManager);
      return this.utilityService.getSuccessMessage(
        VehicleEntityFields.VEHICLE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
