import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetDto, UpdateAssetDto, AssetActionDto, AssetQueryDto } from './dto';
import { AssetMastersRepository } from './asset-masters.repository';
import { AssetMasterEntity } from './entities/asset-master.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  DEFAULT_ASSET_FILE_TYPES,
  ASSET_MASTERS_ERRORS,
  AssetMasterEntityFields,
  AssetEventTypes,
} from './constants/asset-masters.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssetFilesService } from '../asset-files/asset-files.service';
import { AssetEventsService } from '../asset-events/asset-events.service';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { getAssetQuery } from './queries/get-asset.query';

@Injectable()
export class AssetMastersService {
  constructor(
    private readonly assetMastersRepository: AssetMastersRepository,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetEventsService: AssetEventsService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createAssetDto: CreateAssetDto & { createdBy: string }, assetFiles: string[]) {
    try {
      const { registrationNo, createdBy } = createAssetDto;
      const asset = await this.findOne({ where: { registrationNo } });
      if (asset) {
        throw new ConflictException(ASSET_MASTERS_ERRORS.ASSET_ALREADY_EXISTS);
      }
      return await this.dataSource.transaction(async (entityManager) => {
        const assetMaster = await this.assetMastersRepository.create(
          { ...createAssetDto, createdBy },
          entityManager,
        );

        await this.assetVersionsService.create(
          {
            ...createAssetDto,
            createdBy,
            assetMasterId: assetMaster.id,
            number: registrationNo,
          },
          entityManager,
        );

        const assetAddedEvent = await this.assetEventsService.create(
          {
            assetMasterId: assetMaster.id,
            eventType: AssetEventTypes.ASSET_ADDED,
            createdBy,
          },
          entityManager,
        );

        await this.assetEventsService.create(
          {
            assetMasterId: assetMaster.id,
            eventType: AssetEventTypes.AVAILABLE,
            createdBy,
          },
          entityManager,
        );

        await this.assetFilesService.create(
          {
            assetMasterId: assetMaster.id,
            fileType: DEFAULT_ASSET_FILE_TYPES.ASSET_IMAGE_DOC,
            fileKeys: assetFiles,
            assetEventsId: assetAddedEvent.id,
            createdBy,
          },
          entityManager,
        );

        return assetMaster;
      });
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
      return await this.assetEventsService.action(
        { ...assetActionDto, assetMasterId: assetActionDto.assetId },
        assetFiles,
        createdBy,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<AssetMasterEntity>) {
    try {
      return await this.assetMastersRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: AssetQueryDto) {
    try {
      const { dataQuery, countQuery, params } = await getAssetQuery(findOptions);
      const [assets, total] = await Promise.all([
        this.assetMastersRepository.executeRawQuery(dataQuery, params) as Promise<
          AssetMasterEntity[]
        >,
        this.assetMastersRepository.executeRawQuery(countQuery, params) as Promise<{
          total: number;
        }>,
      ]);
      return this.utilityService.listResponse(assets, total[0].total);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<AssetMasterEntity>) {
    try {
      const asset = await this.assetMastersRepository.findOne(findOptions);
      if (!asset) {
        throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
      }
      return asset;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    updateData: Partial<AssetMasterEntity> | (UpdateAssetDto & { createdBy: string }),
    entityManager?: EntityManager,
  ) {
    try {
      const asset = await this.findOneOrFail({ where: identifierConditions });
      if (asset.registrationNo === updateData.registrationNo) {
        throw new ConflictException(ASSET_MASTERS_ERRORS.ASSET_ALREADY_EXISTS);
      }
      await this.assetMastersRepository.update(
        identifierConditions,
        updateData as Partial<AssetMasterEntity>,
        entityManager,
      );
      await this.assetVersionsService.create(
        {
          ...(updateData as any),
          assetMasterId: asset.id,
          createdBy: updateData.createdBy,
        },
        entityManager,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.assetMastersRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        AssetMasterEntityFields.ASSET,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
