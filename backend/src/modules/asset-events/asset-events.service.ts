import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAssetEventDto } from './dto/create-asset-event.dto';
import { DataSource, EntityManager } from 'typeorm';
import { AssetEventsRepository } from './asset-events.repository';
import { AssetActionDto } from '../asset-versions/dto/asset-action.dto';
import { AssetFilesService } from '../asset-files/asset-files.service';
import { AssetEventTypes } from '../asset-masters/constants/asset-masters.constants';
import { ASSET_EVENTS_ERRORS } from './constants/asset-events.constants';
import { AssetEventsQueryDto } from './dto/asset-events-query.dto';

@Injectable()
export class AssetEventsService {
  constructor(
    private readonly assetEventsRepository: AssetEventsRepository,
    private readonly dataSource: DataSource,
    private readonly assetFilesService: AssetFilesService,
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

  async action(
    assetActionDto: AssetActionDto & { fromUserId: string },
    assetFiles: string[],
    createdBy: string,
  ) {
    try {
      const { assetMasterId, action, toUserId, fromUserId, metadata } = assetActionDto;
      await this.dataSource.transaction(async (entityManager: EntityManager) => {
        switch (action) {
          case AssetEventTypes.HANDOVER_INITIATED ||
            AssetEventTypes.HANDOVER_ACCEPTED ||
            AssetEventTypes.HANDOVER_REJECTED ||
            AssetEventTypes.HANDOVER_CANCELLED:
            const assetEvent = await this.create(
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

            if (assetFiles) {
              await this.assetFilesService.create(
                {
                  assetMasterId,
                  fileType: action,
                  fileKeys: assetFiles,
                  assetEventsId: assetEvent.id,
                  createdBy,
                },
                entityManager,
              );
            }
            return assetEvent;

          case AssetEventTypes.DEALLOCATED:
            const deallocationEvent = await this.create(
              {
                assetMasterId,
                eventType: action,
                fromUser: fromUserId,
                metadata,
                createdBy,
              },
              entityManager,
            );
            return deallocationEvent;
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

// TODO: Asset files update rakhna hai ya nahi
