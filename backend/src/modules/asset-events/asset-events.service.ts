import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { CreateAssetEventDto } from './dto/create-asset-event.dto';
import { DataSource, EntityManager, FindOneOptions } from 'typeorm';
import { AssetEventsRepository } from './asset-events.repository';
import { AssetActionDto } from '../asset-versions/dto/asset-action.dto';
import { AssetFilesService } from '../asset-files/asset-files.service';
import {
  AssetEventTypes,
  AssetFileTypes,
  AssetStatus,
  PENDING_REQUEST_EVENT_TYPES,
} from '../asset-masters/constants/asset-masters.constants';
import {
  ASSET_EVENTS_ERRORS,
  ASSET_EVENTS_SUCCESS_MESSAGES,
  VALID_ACTIONS_BY_STATUS,
  HANDOVER_RESPONSE_ACTIONS,
  RETURN_RESPONSE_ACTIONS,
  RETURN_RESPONSE_PERMISSIONS,
} from './constants/asset-events.constants';
import { AssetEventsQueryDto } from './dto/asset-events-query.dto';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { buildAssetEventsQuery, buildAssetEventsStatsQuery } from './queries/asset-events.queries';
import { AssetEventEntity } from './entities/asset-event.entity';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { AssetMasterEntity } from '../asset-masters/entities/asset-master.entity';
import { UserEntity } from '../users/entities/user.entity';
import { NotificationService } from 'src/modules/notifications/notification.service';
import { NotificationEvents } from 'src/modules/notifications/notification.events';
import { NotificationRecipientsService } from 'src/modules/notifications/recipients.service';
import { ManagedUsersService } from '../user-delegations/managed-users.service';

@Injectable()
export class AssetEventsService {
  constructor(
    private readonly assetEventsRepository: AssetEventsRepository,
    private readonly dataSource: DataSource,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly dateTimeService: DateTimeService,
    private readonly whatsAppService: WhatsAppService,
    private readonly notificationService: NotificationService,
    private readonly notificationRecipientsService: NotificationRecipientsService,
    private readonly managedUsersService: ManagedUsersService,
  ) {}

  async create(
    createAssetEventDto: CreateAssetEventDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      return await this.assetEventsRepository.create(createAssetEventDto, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findOneEvent(options: FindOneOptions<AssetEventEntity>, entityManager?: EntityManager) {
    return this.assetEventsRepository.findOne(options, entityManager);
  }

  async updateEventMetadata(
    id: string,
    metadata: Record<string, any>,
    entityManager: EntityManager,
  ) {
    return entityManager.getRepository(AssetEventEntity).update({ id }, { metadata });
  }

  private validateActionRequirements(
    action: AssetEventTypes,
    toUserId: string | undefined,
    assetFiles: string[],
  ): void {
    const hasFiles = assetFiles && assetFiles.length > 0;

    switch (action) {
      case AssetEventTypes.HANDOVER_INITIATED:
        if (!toUserId) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.TO_USER_REQUIRED_FOR_HANDOVER);
        }
        if (!hasFiles) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.FILES_REQUIRED_FOR_HANDOVER_INITIATE);
        }
        break;

      case AssetEventTypes.RETURN_INITIATED:
        if (!hasFiles) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.FILES_REQUIRED_FOR_RETURN_INITIATE);
        }
        break;

      case AssetEventTypes.CALIBRATED:
        if (!hasFiles) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.FILES_REQUIRED_FOR_CALIBRATION);
        }
        break;

      // Optional files for these actions.
      // HANDOVER_ACCEPTED used to require files as condition evidence from the receiver; that was
      // dropped so an accept is never blocked when the receiver cannot photograph the asset. Files
      // are still attached normally when sent. Who may accept is unaffected — a pending handover
      // must exist and only its target user can accept it.
      case AssetEventTypes.HANDOVER_ACCEPTED:
      case AssetEventTypes.HANDOVER_REJECTED:
      case AssetEventTypes.HANDOVER_CANCELLED:
      case AssetEventTypes.RETURN_ACCEPTED:
      case AssetEventTypes.RETURN_REJECTED:
      case AssetEventTypes.RETURN_CANCELLED:
      case AssetEventTypes.DEALLOCATED:
      case AssetEventTypes.UNDER_MAINTENANCE:
      case AssetEventTypes.DAMAGED:
      case AssetEventTypes.RETIRED:
      case AssetEventTypes.AVAILABLE:
        break;
    }
  }

  private getFileTypeForAction(action: AssetEventTypes): string {
    switch (action) {
      case AssetEventTypes.CALIBRATED:
        return AssetFileTypes.CALIBRATION_CERTIFICATE;
      case AssetEventTypes.DAMAGED:
        return AssetFileTypes.REPAIR_REPORT;
      default:
        return AssetFileTypes.OTHER;
    }
  }

  private async getLastEvent(assetMasterId: string): Promise<AssetEventEntity | null> {
    const result = await this.assetEventsRepository.findOne({
      where: { assetMasterId },
      order: { createdAt: SortOrder.DESC },
    });
    return result || null;
  }

  /** The open handover or return to office, if the asset's last event is one. */
  private async getPendingRequest(assetMasterId: string): Promise<AssetEventEntity | null> {
    const lastEvent = await this.getLastEvent(assetMasterId);

    if (lastEvent && PENDING_REQUEST_EVENT_TYPES.includes(lastEvent.eventType as AssetEventTypes)) {
      return lastEvent;
    }
    return null;
  }

  private validateStateTransition(
    currentStatus: string,
    action: AssetEventTypes,
    pendingRequest: AssetEventEntity | null,
  ): void {
    // A response must answer the kind of request that is open, so a handover accept can never
    // close a return or the other way round.
    if (HANDOVER_RESPONSE_ACTIONS.includes(action)) {
      if (pendingRequest?.eventType !== AssetEventTypes.HANDOVER_INITIATED) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.NO_HANDOVER_PENDING);
      }
      return;
    }
    if (RETURN_RESPONSE_ACTIONS.includes(action)) {
      if (pendingRequest?.eventType !== AssetEventTypes.RETURN_INITIATED) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.NO_RETURN_PENDING);
      }
      return;
    }
    if (pendingRequest) {
      throw new BadRequestException(
        pendingRequest.eventType === AssetEventTypes.HANDOVER_INITIATED
          ? ASSET_EVENTS_ERRORS.HANDOVER_ALREADY_PENDING
          : ASSET_EVENTS_ERRORS.REQUEST_ALREADY_PENDING,
      );
    }

    const validActions = VALID_ACTIONS_BY_STATUS[currentStatus] || [];
    if (!validActions.includes(action)) {
      throw new BadRequestException(
        ASSET_EVENTS_ERRORS.INVALID_STATE_TRANSITION.replace('{action}', action).replace(
          '{status}',
          currentStatus,
        ),
      );
    }
  }

  private validateHandoverPermissions(
    action: AssetEventTypes,
    pendingHandover: AssetEventEntity,
    currentUserId: string,
  ): void {
    if (action === AssetEventTypes.HANDOVER_ACCEPTED) {
      if (pendingHandover.toUser !== currentUserId) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.ONLY_TARGET_USER_CAN_ACCEPT);
      }
    } else if (action === AssetEventTypes.HANDOVER_REJECTED) {
      if (pendingHandover.toUser !== currentUserId) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.ONLY_TARGET_USER_CAN_REJECT);
      }
    } else if (action === AssetEventTypes.HANDOVER_CANCELLED) {
      if (pendingHandover.createdBy !== currentUserId) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.ONLY_INITIATOR_CAN_CANCEL);
      }
    }
  }

  /**
   * A return has no target user, so the answer is gated by permission instead: office staff with
   * `asset.return-accepted` / `asset.return-rejected` respond, and never to their own return.
   * Only the person who started the return can cancel it.
   */
  private async validateReturnPermissions(
    action: AssetEventTypes,
    pendingReturn: AssetEventEntity,
    currentUserId: string,
    activeRole: string | undefined,
  ): Promise<void> {
    if (action === AssetEventTypes.RETURN_CANCELLED) {
      if (pendingReturn.createdBy !== currentUserId) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.ONLY_INITIATOR_CAN_CANCEL_RETURN);
      }
      return;
    }

    if (pendingReturn.createdBy === currentUserId) {
      throw new BadRequestException(ASSET_EVENTS_ERRORS.CANNOT_RESPOND_TO_OWN_RETURN);
    }

    const permission = RETURN_RESPONSE_PERMISSIONS[action];
    const allowed =
      !!permission &&
      (await this.managedUsersService.hasPermission(currentUserId, activeRole, permission));
    if (!allowed) {
      throw new ForbiddenException(
        ASSET_EVENTS_ERRORS.RETURN_PERMISSION_REQUIRED.replace(
          '{action}',
          action === AssetEventTypes.RETURN_ACCEPTED ? 'accept' : 'reject',
        ),
      );
    }
  }

  private getUserFullName(user: UserEntity): string {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.email || 'User';
  }

  private async sendAssetTransactionWhatsappNotification(input: {
    action: AssetEventTypes;
    assetMasterId: string;
    recipientUserId: string;
    actorUserId: string;
  }): Promise<void> {
    try {
      const userRepo = this.dataSource.getRepository(UserEntity);
      const assetMasterRepo = this.dataSource.getRepository(AssetMasterEntity);

      const [assetMaster, recipient, actor] = await Promise.all([
        assetMasterRepo.findOne({ where: { id: input.assetMasterId } }),
        userRepo.findOne({ where: { id: input.recipientUserId } }),
        userRepo.findOne({ where: { id: input.actorUserId } }),
      ]);

      if (!recipient || !actor) return;

      // Bell + push — independent of WhatsApp opt-in.
      void this.notificationService.notify({
        userIds: [recipient.id],
        createdBy: actor.id,
        email: true,
        ...NotificationEvents.assetTransaction({
          assetMasterId: input.assetMasterId,
          assetId: assetMaster?.assetId || input.assetMasterId,
          action: input.action,
          byName: this.getUserFullName(actor),
        }),
      });

      const whatsappNumber = recipient.whatsappNumber || recipient.contactNumber;
      if (!recipient.whatsappOptIn || !whatsappNumber) return;

      await this.whatsAppService.sendAssetTransaction(
        whatsappNumber,
        {
          employeeName: this.getUserFullName(recipient),
          assetId: assetMaster?.assetId || input.assetMasterId,
          actorName: this.getUserFullName(actor),
          action: input.action,
        },
        {
          referenceId: input.assetMasterId,
          recipientId: recipient.id,
        },
      );
    } catch {
      // Don't block business flow if WhatsApp fails
    }
  }

  async action(
    assetActionDto: AssetActionDto & { fromUserId: string; activeRole?: string },
    assetFiles: string[],
    createdBy: string,
  ) {
    try {
      const { assetMasterId, action, toUserId, fromUserId, activeRole, metadata } = assetActionDto;

      // Validate action-specific requirements (files, toUserId etc)
      this.validateActionRequirements(action, toUserId, assetFiles);

      // Get current asset state
      const activeVersion = await this.assetVersionsService.findOne({
        where: { assetMasterId, isActive: true },
      });

      const currentStatus = activeVersion?.status || 'AVAILABLE';

      // Check for a pending handover or return to office
      const pendingRequest = await this.getPendingRequest(assetMasterId);
      const pendingHandover =
        pendingRequest?.eventType === AssetEventTypes.HANDOVER_INITIATED ? pendingRequest : null;
      const pendingReturn =
        pendingRequest?.eventType === AssetEventTypes.RETURN_INITIATED ? pendingRequest : null;

      // Validate state transition
      this.validateStateTransition(currentStatus, action, pendingRequest);

      // Validate handover permissions if it's a handover response action
      if (HANDOVER_RESPONSE_ACTIONS.includes(action) && pendingHandover) {
        this.validateHandoverPermissions(action, pendingHandover, fromUserId);
      }

      if (RETURN_RESPONSE_ACTIONS.includes(action) && pendingReturn) {
        await this.validateReturnPermissions(action, pendingReturn, fromUserId, activeRole);
      }

      if (action === AssetEventTypes.RETURN_INITIATED && activeVersion?.assignedTo !== fromUserId) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.ONLY_ASSIGNEE_CAN_RETURN);
      }

      let whatsappNotification:
        | {
            action: AssetEventTypes;
            assetMasterId: string;
            recipientUserId: string;
            actorUserId: string;
          }
        | undefined;

      await this.dataSource.transaction(async (entityManager: EntityManager) => {
        switch (action) {
          // Handover Initiate - requires toUserId and files
          case AssetEventTypes.HANDOVER_INITIATED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                toUser: toUserId,
                fromUser: fromUserId,
                metadata,
                createdBy,
              },
              entityManager,
            );

            await this.assetFilesService.create(
              {
                assetMasterId,
                fileType: AssetFileTypes.ASSET_IMAGE,
                fileKeys: assetFiles,
                assetEventsId: event.id,
                createdBy,
              },
              entityManager,
            );

            if (toUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: toUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Handover Accept - files mandatory, userId derived from JWT
          case AssetEventTypes.HANDOVER_ACCEPTED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                toUser: fromUserId, // The person accepting is the toUser
                fromUser: activeVersion?.assignedTo, // Previous holder
                metadata,
                createdBy,
              },
              entityManager,
            );

            await this.assetFilesService.create(
              {
                assetMasterId,
                fileType: AssetFileTypes.ASSET_IMAGE,
                fileKeys: assetFiles,
                assetEventsId: event.id,
                createdBy,
              },
              entityManager,
            );

            // Update version: status -> ASSIGNED, assignedTo -> the person who accepted
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.ASSIGNED, assignedTo: fromUserId, updatedBy: createdBy },
              entityManager,
            );

            const initiatorUserId = pendingHandover?.fromUser;
            if (initiatorUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: initiatorUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Handover Reject - files optional, userId derived from JWT
          case AssetEventTypes.HANDOVER_REJECTED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                toUser: pendingHandover?.fromUser, // Asset goes back to the original holder (initiator)
                fromUser: fromUserId, // The person rejecting
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: AssetFileTypes.OTHER,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            const initiatorUserId = pendingHandover?.fromUser;
            if (initiatorUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: initiatorUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Handover Cancel - files optional, userId derived from JWT
          case AssetEventTypes.HANDOVER_CANCELLED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: fromUserId, // The person cancelling
                toUser: fromUserId, // Asset stays with the canceller
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: AssetFileTypes.OTHER,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            const assigneeUserId = pendingHandover?.toUser;
            if (assigneeUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: assigneeUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Return to office - only the holder, files mandatory. No target user: office staff answer it.
          case AssetEventTypes.RETURN_INITIATED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: fromUserId, // The holder returning the asset
                metadata,
                createdBy,
              },
              entityManager,
            );

            await this.assetFilesService.create(
              {
                assetMasterId,
                fileType: AssetFileTypes.ASSET_IMAGE,
                fileKeys: assetFiles,
                assetEventsId: event.id,
                createdBy,
              },
              entityManager,
            );
            break;
          }

          // Return accepted - the asset is back at the office: available, nobody holds it
          case AssetEventTypes.RETURN_ACCEPTED: {
            const holderUserId = pendingReturn?.fromUser;
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: holderUserId, // The holder who returned it; createdBy is who accepted
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: AssetFileTypes.ASSET_IMAGE,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.AVAILABLE, assignedTo: null, updatedBy: createdBy },
              entityManager,
            );

            if (holderUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: holderUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Return rejected / cancelled - the asset stays with the holder, nothing else changes
          case AssetEventTypes.RETURN_REJECTED:
          case AssetEventTypes.RETURN_CANCELLED: {
            const holderUserId = pendingReturn?.fromUser;
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: holderUserId, // The holder; createdBy is who rejected or cancelled
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: AssetFileTypes.OTHER,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            // The holder cancelled it themselves, so only a rejection needs telling them.
            if (action === AssetEventTypes.RETURN_REJECTED && holderUserId) {
              whatsappNotification = {
                action,
                assetMasterId,
                recipientUserId: holderUserId,
                actorUserId: fromUserId,
              };
            }
            break;
          }

          // Deallocate - fromUser auto-derived from asset's assignedTo
          case AssetEventTypes.DEALLOCATED: {
            if (!activeVersion?.assignedTo) {
              throw new BadRequestException(ASSET_EVENTS_ERRORS.ASSET_NOT_ASSIGNED);
            }

            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion.assignedTo, // Auto-derived from asset's current holder
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: AssetFileTypes.OTHER,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            // Update version: status -> AVAILABLE, clear assignedTo
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.AVAILABLE, assignedTo: null, updatedBy: createdBy },
              entityManager,
            );

            whatsappNotification = {
              action,
              assetMasterId,
              recipientUserId: activeVersion.assignedTo,
              actorUserId: createdBy,
            };
            break;
          }

          // Calibrated - files mandatory (calibration certificate)
          case AssetEventTypes.CALIBRATED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                metadata,
                createdBy,
              },
              entityManager,
            );

            await this.assetFilesService.create(
              {
                assetMasterId,
                fileType: AssetFileTypes.CALIBRATION_CERTIFICATE,
                fileKeys: assetFiles,
                assetEventsId: event.id,
                createdBy,
              },
              entityManager,
            );
            break;
          }

          // Under Maintenance - files optional, track who had it
          case AssetEventTypes.UNDER_MAINTENANCE: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo,
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: this.getFileTypeForAction(action),
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            // Update version: status -> UNDER_MAINTENANCE
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.UNDER_MAINTENANCE, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          // Damaged - files optional, track who had it
          case AssetEventTypes.DAMAGED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo,
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: this.getFileTypeForAction(action),
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            // Update version: status -> DAMAGED
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.DAMAGED, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          // Retired - files optional, track who had it
          case AssetEventTypes.RETIRED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo,
                metadata,
                createdBy,
              },
              entityManager,
            );

            if (assetFiles && assetFiles.length > 0) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: this.getFileTypeForAction(action),
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
            }

            // Update version: status -> RETIRED
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.RETIRED, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          // Available - no files needed, track previous holder
          case AssetEventTypes.AVAILABLE: {
            await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo, // Previous holder (if any)
                metadata,
                createdBy,
              },
              entityManager,
            );

            // Update version: status -> AVAILABLE, clear assignedTo
            await this.assetVersionsService.update(
              { assetMasterId, isActive: true },
              { status: AssetStatus.AVAILABLE, assignedTo: null, updatedBy: createdBy },
              entityManager,
            );
            break;
          }

          default:
            throw new BadRequestException(ASSET_EVENTS_ERRORS.INVALID_ACTION);
        }
      });

      if (whatsappNotification) {
        void this.sendAssetTransactionWhatsappNotification(whatsappNotification);
      }

      if (action === AssetEventTypes.RETURN_INITIATED) {
        void this.notifyOfficeOfReturn(assetMasterId, fromUserId);
      }

      return {
        message: ASSET_EVENTS_SUCCESS_MESSAGES[action],
      };
    } catch (error) {
      throw error;
    }
  }

  /** A return has no target user, so everyone who may accept it hears about it. */
  private async notifyOfficeOfReturn(assetMasterId: string, holderUserId: string): Promise<void> {
    const recipients = await this.notificationRecipientsService.usersWithPermission(
      RETURN_RESPONSE_PERMISSIONS[AssetEventTypes.RETURN_ACCEPTED],
    );

    await Promise.all(
      recipients
        .filter((userId) => userId !== holderUserId)
        .map((recipientUserId) =>
          this.sendAssetTransactionWhatsappNotification({
            action: AssetEventTypes.RETURN_INITIATED,
            assetMasterId,
            recipientUserId,
            actorUserId: holderUserId,
          }),
        ),
    );
  }

  async findAll(assetMasterId: string, query: AssetEventsQueryDto, timezone: string) {
    const { startDate, endDate } = query;

    let startDateUTC: Date | undefined;
    let endDateUTC: Date | undefined;

    if (startDate) {
      startDateUTC = this.dateTimeService.getDateInUTC(startDate, timezone, false);
    }
    if (endDate) {
      endDateUTC = this.dateTimeService.getDateInUTC(endDate, timezone, true);
    }

    const { dataQuery, countQuery, params, countParams } = buildAssetEventsQuery({
      assetMasterId,
      query,
      startDateUTC,
      endDateUTC,
    });

    const { query: statsQuery, params: statsParams } = buildAssetEventsStatsQuery(assetMasterId);

    const [events, totalResult, statsResult] = await Promise.all([
      this.assetEventsRepository.executeRawQuery(dataQuery, params),
      this.assetEventsRepository.executeRawQuery(countQuery, countParams),
      this.assetEventsRepository.executeRawQuery(statsQuery, statsParams),
    ]);

    const statsRow = statsResult[0] || {};

    const stats = {
      total: Number(statsRow.total || 0),
      byEventType: {
        ASSET_ADDED: Number(statsRow.ASSET_ADDED || 0),
        AVAILABLE: Number(statsRow.AVAILABLE || 0),
        ASSIGNED: Number(statsRow.ASSIGNED || 0),
        DEALLOCATED: Number(statsRow.DEALLOCATED || 0),
        UNDER_MAINTENANCE: Number(statsRow.UNDER_MAINTENANCE || 0),
        CALIBRATED: Number(statsRow.CALIBRATED || 0),
        DAMAGED: Number(statsRow.DAMAGED || 0),
        RETIRED: Number(statsRow.RETIRED || 0),
        UPDATED: Number(statsRow.UPDATED || 0),
        HANDOVER_INITIATED: Number(statsRow.HANDOVER_INITIATED || 0),
        HANDOVER_ACCEPTED: Number(statsRow.HANDOVER_ACCEPTED || 0),
        HANDOVER_REJECTED: Number(statsRow.HANDOVER_REJECTED || 0),
        HANDOVER_CANCELLED: Number(statsRow.HANDOVER_CANCELLED || 0),
        RETURN_INITIATED: Number(statsRow.RETURN_INITIATED || 0),
        RETURN_ACCEPTED: Number(statsRow.RETURN_ACCEPTED || 0),
        RETURN_REJECTED: Number(statsRow.RETURN_REJECTED || 0),
        RETURN_CANCELLED: Number(statsRow.RETURN_CANCELLED || 0),
        LOST: Number(statsRow.LOST || 0),
        RECOVERED: Number(statsRow.RECOVERED || 0),
      },
    };

    return {
      stats,
      records: events,
      totalRecords: Number(totalResult[0]?.total || 0),
    };
  }
}
