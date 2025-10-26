import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEventsRepository } from './vehicle-events.repository';
import { VehicleActionDto } from '../vehicle-versions/dto/vehicle-action.dto';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import { VehicleEventTypes } from '../vehicle-masters/constants/vehicle-masters.constants';
import { VEHICLE_EVENTS_ERRORS } from './constants/vehicle-events.constants';
import { VehicleEventsQueryDto } from './dto/vehicle-events-query.dto';

@Injectable()
export class VehicleEventsService {
  constructor(
    private readonly vehicleEventsRepository: VehicleEventsRepository,
    private readonly dataSource: DataSource,
    private readonly vehicleFilesService: VehicleFilesService,
  ) {}

  async create(
    createVehicleEventDto: CreateVehicleEventDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      return await this.vehicleEventsRepository.create(createVehicleEventDto, entityManager);
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
      const { vehicleMasterId, action, toUserId, fromUserId, metadata } = vehicleActionDto;
      await this.dataSource.transaction(async (entityManager: EntityManager) => {
        switch (action) {
          case VehicleEventTypes.HANDOVER_INITIATED ||
            VehicleEventTypes.HANDOVER_ACCEPTED ||
            VehicleEventTypes.HANDOVER_REJECTED ||
            VehicleEventTypes.HANDOVER_CANCELLED:
            const vehicleEvent = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                toUser: toUserId,
                fromUser: fromUserId,
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles) {
              await this.vehicleFilesService.create(
                {
                  vehicleMasterId,
                  fileType: action,
                  fileKeys: vehicleFiles,
                  vehicleEventsId: vehicleEvent.id,
                  createdBy,
                },
                entityManager,
              );
            }
            return vehicleEvent;

          case VehicleEventTypes.DEALLOCATED:
            const deallocationEvent = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                fromUser: fromUserId,
                metadata,
                createdBy,
              },
              entityManager,
            );
            return deallocationEvent;
          default:
            throw new BadRequestException(VEHICLE_EVENTS_ERRORS.INVALID_ACTION);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async findAll(vehicleMasterId: string, query: VehicleEventsQueryDto) {
    try {
      return await this.vehicleEventsRepository.findAll({
        where: {
          vehicleMasterId,
        },
        ...query,
        relations: ['vehicleFiles'],
      });
    } catch (error) {
      throw error;
    }
  }
}

// TODO: Vehicle files update rakhna hai ya nahi
