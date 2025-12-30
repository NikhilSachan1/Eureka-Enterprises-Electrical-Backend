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
import { ASSET_EVENTS_ERRORS } from './constants/asset-events.constants';
import { AssetEventsQueryDto } from './dto/asset-events-query.dto';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';

@Injectable()
export class AssetEventsService {
  constructor(
    private readonly assetEventsRepository: AssetEventsRepository,
    private readonly dataSource: DataSource,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetVersionsService: AssetVersionsService,
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

  async action(
    assetActionDto: AssetActionDto & { fromUserId: string },
    assetFiles: string[],
    createdBy: string,
  ) {
    try {
      const { assetMasterId, action, toUserId, fromUserId, metadata } = assetActionDto;

      // Validate action-specific requirements
      this.validateActionRequirements(action, toUserId, assetFiles);

      return await this.dataSource.transaction(async (entityManager: EntityManager) => {
        const activeVersion = await this.assetVersionsService.findOne({
          where: { assetMasterId, isActive: true },
        });

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

            return event;
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

            return event;
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

            return event;
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

            return event;
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

            return event;
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

            return event;
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

            return event;
          }

          // Available - no files needed, track previous holder
          case AssetEventTypes.AVAILABLE: {
            return await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: activeVersion?.assignedTo, // Previous holder (if any)
                metadata,
                createdBy,
              },
              entityManager,
            );
          }

          default:
            throw new BadRequestException(ASSET_EVENTS_ERRORS.INVALID_ACTION);
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async findAll(assetMasterId: string, query: AssetEventsQueryDto) {
    try {
      return await this.assetEventsRepository.findAll({
        where: {
          assetMasterId,
        },
        ...query,
        relations: ['assetFiles'],
      });
    } catch (error) {
      throw error;
    }
  }
}
