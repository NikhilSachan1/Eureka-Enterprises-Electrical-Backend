import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEventsRepository } from './vehicle-events.repository';
import { VehicleActionDto } from '../vehicle-versions/dto/vehicle-action.dto';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import {
  VehicleEventTypes,
  VehicleFileTypes,
} from '../vehicle-masters/constants/vehicle-masters.constants';
import {
  VEHICLE_EVENTS_ERRORS,
  VEHICLE_EVENTS_SUCCESS_MESSAGES,
} from './constants/vehicle-events.constants';
import { VehicleEventsQueryDto } from './dto/vehicle-events-query.dto';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { buildVehicleEventsStatsQuery } from './queries/vehicle-events.queries';

@Injectable()
export class VehicleEventsService {
  constructor(
    private readonly vehicleEventsRepository: VehicleEventsRepository,
    private readonly dataSource: DataSource,
    private readonly vehicleFilesService: VehicleFilesService,
    private readonly vehicleVersionsService: VehicleVersionsService,
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

  /**
   * Validates action-specific requirements
   */
  private validateActionRequirements(
    action: VehicleEventTypes,
    toUserId: string | undefined,
    vehicleFiles: string[],
  ): void {
    const hasFiles = vehicleFiles && vehicleFiles.length > 0;

    switch (action) {
      case VehicleEventTypes.HANDOVER_INITIATED:
        if (!toUserId) {
          throw new BadRequestException(VEHICLE_EVENTS_ERRORS.TO_USER_REQUIRED_FOR_HANDOVER);
        }
        if (!hasFiles) {
          throw new BadRequestException(VEHICLE_EVENTS_ERRORS.FILES_REQUIRED_FOR_HANDOVER_INITIATE);
        }
        break;

      case VehicleEventTypes.HANDOVER_ACCEPTED:
        if (!hasFiles) {
          throw new BadRequestException(VEHICLE_EVENTS_ERRORS.FILES_REQUIRED_FOR_HANDOVER_ACCEPT);
        }
        break;

      // Optional files for these actions
      case VehicleEventTypes.HANDOVER_REJECTED:
      case VehicleEventTypes.HANDOVER_CANCELLED:
      case VehicleEventTypes.DEALLOCATED:
      case VehicleEventTypes.UNDER_MAINTENANCE:
      case VehicleEventTypes.DAMAGED:
      case VehicleEventTypes.RETIRED:
      case VehicleEventTypes.AVAILABLE:
        // No mandatory requirements
        break;
    }
  }

  async action(
    vehicleActionDto: VehicleActionDto & { fromUserId: string },
    vehicleFiles: string[],
    createdBy: string,
  ) {
    try {
      const { vehicleMasterId, action, toUserId, fromUserId, metadata } = vehicleActionDto;

      // Validate action-specific requirements
      this.validateActionRequirements(action, toUserId, vehicleFiles);

      await this.dataSource.transaction(async (entityManager: EntityManager) => {
        const activeVersion = await this.vehicleVersionsService.findOne({
          where: { vehicleMasterId, isActive: true },
        });

        switch (action) {
          // Handover Initiate - requires toUserId and files
          case VehicleEventTypes.HANDOVER_INITIATED: {
            const event = await this.create(
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

            await this.vehicleFilesService.create(
              {
                vehicleMasterId,
                fileType: VehicleFileTypes.VEHICLE_IMAGE,
                fileKeys: vehicleFiles,
                vehicleEventsId: event.id,
                createdBy,
              },
              entityManager,
            );
            break;
          }

          // Handover Accept - files mandatory, userId derived from JWT
          case VehicleEventTypes.HANDOVER_ACCEPTED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                toUser: fromUserId, // The person accepting is the toUser
                fromUser: activeVersion?.assignedTo, // Previous holder
                metadata,
                createdBy,
              },
              entityManager,
            );

            await this.vehicleFilesService.create(
              {
                vehicleMasterId,
                fileType: VehicleFileTypes.VEHICLE_IMAGE,
                fileKeys: vehicleFiles,
                vehicleEventsId: event.id,
                createdBy,
              },
              entityManager,
            );
            break;
          }

          // Handover Reject - files optional, userId derived from JWT
          case VehicleEventTypes.HANDOVER_REJECTED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                toUser: fromUserId, // The person rejecting
                fromUser: activeVersion?.assignedTo,
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles && vehicleFiles.length > 0) {
              await this.vehicleFilesService.create(
                {
                  vehicleMasterId,
                  fileType: VehicleFileTypes.OTHER,
                  fileKeys: vehicleFiles,
                  vehicleEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }
            break;
          }

          // Handover Cancel - files optional, userId derived from JWT
          case VehicleEventTypes.HANDOVER_CANCELLED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                fromUser: fromUserId, // The person cancelling
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles && vehicleFiles.length > 0) {
              await this.vehicleFilesService.create(
                {
                  vehicleMasterId,
                  fileType: VehicleFileTypes.OTHER,
                  fileKeys: vehicleFiles,
                  vehicleEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }
            break;
          }

          // Deallocate - fromUser auto-derived from vehicle's assignedTo
          case VehicleEventTypes.DEALLOCATED: {
            if (!activeVersion?.assignedTo) {
              throw new BadRequestException(VEHICLE_EVENTS_ERRORS.VEHICLE_NOT_ASSIGNED);
            }

            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                fromUser: activeVersion.assignedTo, // Auto-derived from vehicle's current holder
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles && vehicleFiles.length > 0) {
              await this.vehicleFilesService.create(
                {
                  vehicleMasterId,
                  fileType: VehicleFileTypes.OTHER,
                  fileKeys: vehicleFiles,
                  vehicleEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }
            break;
          }

          // Under Maintenance, Damaged, Retired - files optional, track who had it
          case VehicleEventTypes.UNDER_MAINTENANCE:
          case VehicleEventTypes.DAMAGED:
          case VehicleEventTypes.RETIRED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo, // Track who had the vehicle
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (vehicleFiles && vehicleFiles.length > 0) {
              await this.vehicleFilesService.create(
                {
                  vehicleMasterId,
                  fileType: VehicleFileTypes.OTHER,
                  fileKeys: vehicleFiles,
                  vehicleEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }
            break;
          }

          // Available - no files needed, track previous holder
          case VehicleEventTypes.AVAILABLE: {
            await this.create(
              {
                vehicleMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo, // Previous holder (if any)
                metadata,
                createdBy,
              },
              entityManager,
            );
            break;
          }

          default:
            throw new BadRequestException(VEHICLE_EVENTS_ERRORS.INVALID_ACTION);
        }
      });

      return {
        message: VEHICLE_EVENTS_SUCCESS_MESSAGES[action],
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll(vehicleMasterId: string, query: VehicleEventsQueryDto) {
    try {
      const { query: statsQuery, params: statsParams } =
        buildVehicleEventsStatsQuery(vehicleMasterId);

      const [eventsResult, statsResult] = await Promise.all([
        this.vehicleEventsRepository.findAll({
          where: {
            vehicleMasterId,
            ...(query.eventType && { eventType: query.eventType as VehicleEventTypes }),
            ...(query.toUser && { toUser: query.toUser }),
            ...(query.fromUser && { fromUser: query.fromUser }),
          },
          relations: ['vehicleFiles'],
          order: { createdAt: 'DESC' },
        }),
        this.vehicleEventsRepository.executeRawQuery(statsQuery, statsParams),
      ]);

      const statsRow = statsResult[0] || {};

      const stats = {
        total: Number(statsRow.total || 0),
        byEventType: {
          VEHICLE_ADDED: Number(statsRow.VEHICLE_ADDED || 0),
          AVAILABLE: Number(statsRow.AVAILABLE || 0),
          ASSIGNED: Number(statsRow.ASSIGNED || 0),
          DEALLOCATED: Number(statsRow.DEALLOCATED || 0),
          UNDER_MAINTENANCE: Number(statsRow.UNDER_MAINTENANCE || 0),
          DAMAGED: Number(statsRow.DAMAGED || 0),
          RETIRED: Number(statsRow.RETIRED || 0),
          UPDATED: Number(statsRow.UPDATED || 0),
          HANDOVER_INITIATED: Number(statsRow.HANDOVER_INITIATED || 0),
          HANDOVER_ACCEPTED: Number(statsRow.HANDOVER_ACCEPTED || 0),
          HANDOVER_REJECTED: Number(statsRow.HANDOVER_REJECTED || 0),
          HANDOVER_CANCELLED: Number(statsRow.HANDOVER_CANCELLED || 0),
        },
      };

      return {
        stats,
        ...eventsResult,
      };
    } catch (error) {
      throw error;
    }
  }
}
