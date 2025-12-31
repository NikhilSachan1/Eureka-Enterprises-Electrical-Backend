import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAssetEventDto } from './dto/create-asset-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { AssetEventsRepository } from './asset-events.repository';
import { AssetActionDto } from '../asset-versions/dto/asset-action.dto';
import { AssetFilesService } from '../asset-files/asset-files.service';
import {
  AssetEventTypes,
  AssetFileTypes,
} from '../asset-masters/constants/asset-masters.constants';
import {
  ASSET_EVENTS_ERRORS,
  ASSET_EVENTS_SUCCESS_MESSAGES,
  VALID_ACTIONS_BY_STATUS,
  HANDOVER_RESPONSE_ACTIONS,
} from './constants/asset-events.constants';
import { AssetEventsQueryDto } from './dto/asset-events-query.dto';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { buildAssetEventsQuery, buildAssetEventsStatsQuery } from './queries/asset-events.queries';
import { AssetEventEntity } from './entities/asset-event.entity';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class AssetEventsService {
  constructor(
    private readonly assetEventsRepository: AssetEventsRepository,
    private readonly dataSource: DataSource,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly dateTimeService: DateTimeService,
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

      case AssetEventTypes.HANDOVER_ACCEPTED:
        if (!hasFiles) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.FILES_REQUIRED_FOR_HANDOVER_ACCEPT);
        }
        break;

      case AssetEventTypes.CALIBRATED:
        if (!hasFiles) {
          throw new BadRequestException(ASSET_EVENTS_ERRORS.FILES_REQUIRED_FOR_CALIBRATION);
        }
        break;

      // Optional files for these actions
      case AssetEventTypes.HANDOVER_REJECTED:
      case AssetEventTypes.HANDOVER_CANCELLED:
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

  private async getPendingHandover(assetMasterId: string): Promise<AssetEventEntity | null> {
    const lastEvent = await this.getLastEvent(assetMasterId);

    if (lastEvent?.eventType === AssetEventTypes.HANDOVER_INITIATED) {
      return lastEvent;
    }
    return null;
  }

  private validateStateTransition(
    currentStatus: string,
    action: AssetEventTypes,
    pendingHandover: AssetEventEntity | null,
  ): void {
    if (HANDOVER_RESPONSE_ACTIONS.includes(action)) {
      if (!pendingHandover) {
        throw new BadRequestException(ASSET_EVENTS_ERRORS.NO_HANDOVER_PENDING);
      }
      return;
    }
    if (pendingHandover) {
      throw new BadRequestException(ASSET_EVENTS_ERRORS.HANDOVER_ALREADY_PENDING);
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

  async action(
    assetActionDto: AssetActionDto & { fromUserId: string },
    assetFiles: string[],
    createdBy: string,
  ) {
    try {
      const { assetMasterId, action, toUserId, fromUserId, metadata } = assetActionDto;

      // Validate action-specific requirements (files, toUserId etc)
      this.validateActionRequirements(action, toUserId, assetFiles);

      // Get current asset state
      const activeVersion = await this.assetVersionsService.findOne({
        where: { assetMasterId, isActive: true },
      });

      const currentStatus = activeVersion?.status || 'AVAILABLE';

      // Check for pending handover
      const pendingHandover = await this.getPendingHandover(assetMasterId);

      // Validate state transition
      this.validateStateTransition(currentStatus, action, pendingHandover);

      // Validate handover permissions if it's a handover response action
      if (HANDOVER_RESPONSE_ACTIONS.includes(action) && pendingHandover) {
        this.validateHandoverPermissions(action, pendingHandover, fromUserId);
      }

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
            break;
          }

          // Handover Reject - files optional, userId derived from JWT
          case AssetEventTypes.HANDOVER_REJECTED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                toUser: fromUserId, // The person rejecting
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
                  fileType: AssetFileTypes.OTHER,
                  fileKeys: assetFiles,
                  assetEventsId: event.id,
                  createdBy,
                },
                entityManager,
              );
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

          // Under Maintenance, Damaged, Retired - files optional, track who had it
          case AssetEventTypes.UNDER_MAINTENANCE:
          case AssetEventTypes.DAMAGED:
          case AssetEventTypes.RETIRED: {
            const event = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo, // Track who had the asset
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
            break;
          }

          default:
            throw new BadRequestException(ASSET_EVENTS_ERRORS.INVALID_ACTION);
        }
      });

      return {
        message: ASSET_EVENTS_SUCCESS_MESSAGES[action],
      };
    } catch (error) {
      throw error;
    }
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
      },
    };

    return {
      stats,
      records: events,
      totalRecords: Number(totalResult[0]?.total || 0),
    };
  }
}
