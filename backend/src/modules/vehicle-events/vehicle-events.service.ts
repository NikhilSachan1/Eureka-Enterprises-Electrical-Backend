import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEventsRepository } from './vehicle-events.repository';
import { VehicleActionDto } from '../vehicles/dto/vehicle-action.dto';
import { VehicleEventTypes, VEHICLE_ERRORS } from '../vehicles/constants/vehicle.constants';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';

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
      const { vehicleId, action, toUserId, fromUserId } = vehicleActionDto;
      await this.dataSource.transaction(async (entityManager: EntityManager) => {
        switch (action) {
          case VehicleEventTypes.HANDOVER_INITIATED ||
            VehicleEventTypes.HANDOVER_ACCEPTED ||
            VehicleEventTypes.HANDOVER_REJECTED ||
            VehicleEventTypes.HANDOVER_CANCELLED:
            const vehicleEvent = await this.create(
              {
                vehicleId,
                eventType: action,
                toUser: toUserId,
                fromUser: fromUserId,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles) {
              await this.vehicleFilesService.create(
                {
                  vehicleId,
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
                vehicleId,
                eventType: action,
                fromUser: fromUserId,
                createdBy,
              },
              entityManager,
            );
            //TODO: Wether to add image while deallocation or not let me know
            return deallocationEvent;

          default:
            throw new BadRequestException(VEHICLE_ERRORS.INVALID_ACTION);
        }
      });
    } catch (error) {
      throw error;
    }
  }
}

// TODO: Vehicle files update rakhna hai ya nahi
