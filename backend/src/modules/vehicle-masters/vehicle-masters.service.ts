import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehicleDto, UpdateVehicleDto, VehicleActionDto, VehicleQueryDto } from './dto';
import { VehicleMastersRepository } from './vehicle-masters.repository';
import { VehicleMasterEntity } from './entities/vehicle-master.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  DEFAULT_VEHICLE_FILE_TYPES,
  VEHICLE_MASTERS_ERRORS,
  VehicleMasterEntityFields,
  VehicleEventTypes,
} from './constants/vehicle-masters.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import { VehicleEventsService } from '../vehicle-events/vehicle-events.service';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { getVehicleQuery } from './queries/get-vehicle.query';

@Injectable()
export class VehicleMastersService {
  constructor(
    private readonly vehicleMastersRepository: VehicleMastersRepository,
    private readonly vehicleFilesService: VehicleFilesService,
    private readonly vehicleEventsService: VehicleEventsService,
    private readonly vehicleVersionsService: VehicleVersionsService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createVehicleDto: CreateVehicleDto & { createdBy: string }, vehicleFiles: string[]) {
    try {
      const { registrationNo, createdBy } = createVehicleDto;
      const vehicle = await this.findOne({ where: { registrationNo } });
      if (vehicle) {
        throw new ConflictException(VEHICLE_MASTERS_ERRORS.VEHICLE_ALREADY_EXISTS);
      }
      return await this.dataSource.transaction(async (entityManager) => {
        const vehicleMaster = await this.vehicleMastersRepository.create(
          { ...createVehicleDto, createdBy },
          entityManager,
        );

        await this.vehicleVersionsService.create(
          {
            ...createVehicleDto,
            createdBy,
            vehicleMasterId: vehicleMaster.id,
            number: registrationNo,
          },
          entityManager,
        );

        const vehicleAddedEvent = await this.vehicleEventsService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            eventType: VehicleEventTypes.VEHICLE_ADDED,
            createdBy,
          },
          entityManager,
        );

        await this.vehicleEventsService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            eventType: VehicleEventTypes.AVAILABLE,
            createdBy,
          },
          entityManager,
        );

        await this.vehicleFilesService.create(
          {
            vehicleMasterId: vehicleMaster.id,
            fileType: DEFAULT_VEHICLE_FILE_TYPES.VEHICLE_IMAGE_DOC,
            fileKeys: vehicleFiles,
            vehicleEventsId: vehicleAddedEvent.id,
            createdBy,
          },
          entityManager,
        );

        return vehicleMaster;
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
      return await this.vehicleEventsService.action(
        { ...vehicleActionDto, vehicleMasterId: vehicleActionDto.vehicleId },
        vehicleFiles,
        createdBy,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<VehicleMasterEntity>) {
    try {
      return await this.vehicleMastersRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: VehicleQueryDto) {
    try {
      const { dataQuery, countQuery, params } = await getVehicleQuery(findOptions);
      const [vehicles, total] = await Promise.all([
        this.vehicleMastersRepository.executeRawQuery(dataQuery, params) as Promise<
          VehicleMasterEntity[]
        >,
        this.vehicleMastersRepository.executeRawQuery(countQuery, params) as Promise<{
          total: number;
        }>,
      ]);
      return this.utilityService.listResponse(vehicles, total[0].total);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<VehicleMasterEntity>) {
    try {
      const vehicle = await this.vehicleMastersRepository.findOne(findOptions);
      if (!vehicle) {
        throw new NotFoundException(VEHICLE_MASTERS_ERRORS.VEHICLE_NOT_FOUND);
      }
      return vehicle;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    updateData: Partial<VehicleMasterEntity> | (UpdateVehicleDto & { createdBy: string }),
    entityManager?: EntityManager,
  ) {
    try {
      const vehicle = await this.findOneOrFail({ where: identifierConditions });
      if (vehicle.registrationNo === updateData.registrationNo) {
        throw new ConflictException(VEHICLE_MASTERS_ERRORS.VEHICLE_ALREADY_EXISTS);
      }
      await this.vehicleMastersRepository.update(
        identifierConditions,
        updateData as Partial<VehicleMasterEntity>,
        entityManager,
      );
      await this.vehicleVersionsService.create(
        {
          ...(updateData as any),
          vehicleMasterId: vehicle.id,
          createdBy: updateData.createdBy,
        },
        entityManager,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.vehicleMastersRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        VehicleMasterEntityFields.VEHICLE,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
