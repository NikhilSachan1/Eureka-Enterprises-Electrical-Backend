import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVehicleEventDto } from './dto/create-vehicle-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEventsRepository } from './vehicle-events.repository';
import { VehicleActionDto } from '../vehicle-versions/dto/vehicle-action.dto';
import { VehicleFilesService } from '../vehicle-files/vehicle-files.service';
import {
  VehicleEventTypes,
  VehicleFileTypes,
  VehicleStatus,
} from '../vehicle-masters/constants/vehicle-masters.constants';
import {
  VEHICLE_EVENTS_ERRORS,
  VEHICLE_EVENTS_SUCCESS_MESSAGES,
  VALID_ACTIONS_BY_STATUS,
  HANDOVER_RESPONSE_ACTIONS,
} from './constants/vehicle-events.constants';
import { VehicleEventsQueryDto } from './dto/vehicle-events-query.dto';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import {
  buildVehicleEventsStatsQuery,
  buildVehicleEventsQuery,
} from './queries/vehicle-events.queries';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { VehicleEventEntity } from './entities/vehicle-event.entity';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { VehicleMasterEntity } from '../vehicle-masters/entities/vehicle-master.entity';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class VehicleEventsService {
  constructor(
    private readonly vehicleEventsRepository: VehicleEventsRepository,
    private readonly dataSource: DataSource,
    private readonly vehicleFilesService: VehicleFilesService,
    private readonly vehicleVersionsService: VehicleVersionsService,
    private readonly dateTimeService: DateTimeService,
    private readonly whatsAppService: WhatsAppService,
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

  private async getLastEvent(vehicleMasterId: string): Promise<VehicleEventEntity | null> {
    const result = await this.vehicleEventsRepository.findOne({
      where: { vehicleMasterId },
      order: { createdAt: SortOrder.DESC },
    });
    return result || null;
  }

  private async getPendingHandover(vehicleMasterId: string): Promise<VehicleEventEntity | null> {
    const lastEvent = await this.getLastEvent(vehicleMasterId);

    if (lastEvent?.eventType === VehicleEventTypes.HANDOVER_INITIATED) {
      return lastEvent;
    }
    return null;
  }

  private validateStateTransition(
    currentStatus: string,
    action: VehicleEventTypes,
    pendingHandover: VehicleEventEntity | null,
  ): void {
    if (HANDOVER_RESPONSE_ACTIONS.includes(action)) {
      if (!pendingHandover) {
        throw new BadRequestException(VEHICLE_EVENTS_ERRORS.NO_HANDOVER_PENDING);
      }
      return;
    }

    if (pendingHandover) {
      throw new BadRequestException(VEHICLE_EVENTS_ERRORS.HANDOVER_ALREADY_PENDING);
    }

    const validActions = VALID_ACTIONS_BY_STATUS[currentStatus] || [];
    if (!validActions.includes(action)) {
      throw new BadRequestException(
        VEHICLE_EVENTS_ERRORS.INVALID_STATE_TRANSITION.replace('{action}', action).replace(
          '{status}',
          currentStatus,
        ),
      );
    }
  }

  private validateHandoverPermissions(
    action: VehicleEventTypes,
    pendingHandover: VehicleEventEntity,
    currentUserId: string,
  ): void {
    if (action === VehicleEventTypes.HANDOVER_ACCEPTED) {
      if (pendingHandover.toUser !== currentUserId) {
        throw new BadRequestException(VEHICLE_EVENTS_ERRORS.ONLY_TARGET_USER_CAN_ACCEPT);
      }
    } else if (action === VehicleEventTypes.HANDOVER_REJECTED) {
      if (pendingHandover.toUser !== currentUserId) {
        throw new BadRequestException(VEHICLE_EVENTS_ERRORS.ONLY_TARGET_USER_CAN_REJECT);
      }
    } else if (action === VehicleEventTypes.HANDOVER_CANCELLED) {
      if (pendingHandover.createdBy !== currentUserId) {
        throw new BadRequestException(VEHICLE_EVENTS_ERRORS.ONLY_INITIATOR_CAN_CANCEL);
      }
    }
  }

  private getUserFullName(user: UserEntity): string {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || 'User';
  }

  private async sendVehicleTransactionWhatsappNotification(input: {
    action: VehicleEventTypes;
    vehicleMasterId: string;
    recipientUserId: string;
    actorUserId: string;
  }): Promise<void> {
    try {
      const userRepo = this.dataSource.getRepository(UserEntity);
      const vehicleMasterRepo = this.dataSource.getRepository(VehicleMasterEntity);

      const [vehicleMaster, recipient, actor] = await Promise.all([
        vehicleMasterRepo.findOne({ where: { id: input.vehicleMasterId } }),
        userRepo.findOne({ where: { id: input.recipientUserId } }),
        userRepo.findOne({ where: { id: input.actorUserId } }),
      ]);

      if (!recipient || !actor) return;

      const whatsappNumber = recipient.whatsappNumber || recipient.contactNumber;
      if (!recipient.whatsappOptIn || !whatsappNumber) return;

      await this.whatsAppService.sendVehicleTransaction(
        whatsappNumber,
        {
          employeeName: this.getUserFullName(recipient),
          vehicleNumber: vehicleMaster?.registrationNo || input.vehicleMasterId,
          actorName: this.getUserFullName(actor),
          action: input.action,
        },
        {
          referenceId: input.vehicleMasterId,
          recipientId: recipient.id,
        },
      );
    } catch {
      // Don't block business flow if WhatsApp fails
    }
  }

  async action(
    vehicleActionDto: VehicleActionDto & { fromUserId: string },
    vehicleFiles: string[],
    createdBy: string,
  ) {
    try {
      const { vehicleMasterId, action, toUserId, fromUserId, metadata } = vehicleActionDto;

      // Validate action-specific requirements (files, toUserId etc)
      this.validateActionRequirements(action, toUserId, vehicleFiles);

      // Get current vehicle state
      const activeVersion = await this.vehicleVersionsService.findOne({
        where: { vehicleMasterId, isActive: true },
      });

      const currentStatus = activeVersion?.status || 'AVAILABLE';

      const pendingHandover = await this.getPendingHandover(vehicleMasterId);

      this.validateStateTransition(currentStatus, action, pendingHandover);

      if (HANDOVER_RESPONSE_ACTIONS.includes(action) && pendingHandover) {
        this.validateHandoverPermissions(action, pendingHandover, fromUserId);
      }

      let whatsappNotification:
        | {
            action: VehicleEventTypes;
            vehicleMasterId: string;
            recipientUserId: string;
            actorUserId: string;
          }
        | undefined;

      // Validate toUser doesn't already have a vehicle assigned (on initiate)
      if (action === VehicleEventTypes.HANDOVER_INITIATED && toUserId) {
        const existingAssignment = await this.vehicleVersionsService.findOne({
          where: { assignedTo: toUserId, isActive: true, status: VehicleStatus.ASSIGNED },
        });
        if (existingAssignment) {
          throw new BadRequestException(VEHICLE_EVENTS_ERRORS.TO_USER_ALREADY_HAS_VEHICLE);
        }
      }

      // Validate accepting user doesn't already have a vehicle assigned (on accept)
      if (action === VehicleEventTypes.HANDOVER_ACCEPTED) {
        const existingAssignment = await this.vehicleVersionsService.findOne({
          where: { assignedTo: fromUserId, isActive: true, status: VehicleStatus.ASSIGNED },
        });
        if (existingAssignment) {
          throw new BadRequestException(VEHICLE_EVENTS_ERRORS.TO_USER_ALREADY_HAS_VEHICLE);
        }
      }

      await this.dataSource.transaction(async (entityManager: EntityManager) => {
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

            if (toUserId) {
              whatsappNotification = {
                action,
                vehicleMasterId,
                recipientUserId: toUserId,
                actorUserId: fromUserId,
              };
            }
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

            // Update version: status -> ASSIGNED, assignedTo -> the person who accepted
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.ASSIGNED, assignedTo: fromUserId, updatedBy: createdBy },
              entityManager,
            );

            const initiatorUserId = pendingHandover?.fromUser;
            if (initiatorUserId) {
              whatsappNotification = {
                action,
                vehicleMasterId,
                recipientUserId: initiatorUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Handover Reject - files optional, userId derived from JWT
          case VehicleEventTypes.HANDOVER_REJECTED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
                toUser: pendingHandover?.fromUser, // Vehicle goes back to original holder (initiator)
                fromUser: fromUserId, // The person rejecting
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

            const initiatorUserId = pendingHandover?.fromUser;
            if (initiatorUserId) {
              whatsappNotification = {
                action,
                vehicleMasterId,
                recipientUserId: initiatorUserId,
                actorUserId: fromUserId,
              };
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
                toUser: fromUserId, // Asset stays with the canceller
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

            const assigneeUserId = pendingHandover?.toUser;
            if (assigneeUserId) {
              whatsappNotification = {
                action,
                vehicleMasterId,
                recipientUserId: assigneeUserId,
                actorUserId: fromUserId,
              };
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

            // Update version: status -> AVAILABLE, clear assignedTo
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.AVAILABLE, assignedTo: null, updatedBy: createdBy },
              entityManager,
            );

            whatsappNotification = {
              action,
              vehicleMasterId,
              recipientUserId: activeVersion.assignedTo,
              actorUserId: createdBy,
            };
            break;
          }

          // Under Maintenance - files optional, track who had it
          case VehicleEventTypes.UNDER_MAINTENANCE: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
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

            // Update version: status -> UNDER_MAINTENANCE
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.UNDER_MAINTENANCE, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          // Damaged - files optional, track who had it
          case VehicleEventTypes.DAMAGED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
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

            // Update version: status -> DAMAGED
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.DAMAGED, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          // Retired - files optional, track who had it
          case VehicleEventTypes.RETIRED: {
            const event = await this.create(
              {
                vehicleMasterId,
                eventType: action,
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

            // Update version: status -> RETIRED
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.RETIRED, updatedBy: createdBy },
              entityManager,
            );
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

            // Update version: status -> AVAILABLE, clear assignedTo
            await this.vehicleVersionsService.update(
              { vehicleMasterId, isActive: true },
              { status: VehicleStatus.AVAILABLE, assignedTo: null, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          default:
            throw new BadRequestException(VEHICLE_EVENTS_ERRORS.INVALID_ACTION);
        }
      });

      if (whatsappNotification) {
        void this.sendVehicleTransactionWhatsappNotification(whatsappNotification);
      }

      return {
        message: VEHICLE_EVENTS_SUCCESS_MESSAGES[action],
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll(vehicleMasterId: string, query: VehicleEventsQueryDto, timezone: string) {
    try {
      const { startDate, endDate } = query;

      let startDateUTC: Date | undefined;
      let endDateUTC: Date | undefined;

      if (startDate) {
        startDateUTC = this.dateTimeService.getDateInUTC(startDate, timezone, false);
      }
      if (endDate) {
        endDateUTC = this.dateTimeService.getDateInUTC(endDate, timezone, true);
      }

      // Build queries
      const { query: statsQuery, params: statsParams } =
        buildVehicleEventsStatsQuery(vehicleMasterId);

      const { dataQuery, countQuery, params, countParams } = buildVehicleEventsQuery({
        vehicleMasterId,
        query,
        startDateUTC,
        endDateUTC,
      });

      // Execute queries in parallel
      const [eventsResult, countResult, statsResult] = await Promise.all([
        this.vehicleEventsRepository.executeRawQuery(dataQuery, params),
        this.vehicleEventsRepository.executeRawQuery(countQuery, countParams),
        this.vehicleEventsRepository.executeRawQuery(statsQuery, statsParams),
      ]);

      const statsRow = statsResult[0] || {};
      const totalRecords = Number(countResult[0]?.total || 0);

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
        records: eventsResult,
        totalRecords,
      };
    } catch (error) {
      throw error;
    }
  }
}
