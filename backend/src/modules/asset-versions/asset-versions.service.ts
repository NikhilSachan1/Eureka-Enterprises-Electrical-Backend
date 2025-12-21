import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetVersionDto } from './dto';
import { AssetVersionsRepository } from './asset-versions.repository';
import { AssetVersionEntity } from './entities/asset-versions.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  ASSET_VERSION_ERRORS,
  AssetVersionEntityFields,
} from './constants/asset-versions.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class AssetVersionsService {
  constructor(
    private readonly assetVersionsRepository: AssetVersionsRepository,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createAssetVersionDto: CreateAssetVersionDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { createdBy, assetMasterId } = createAssetVersionDto;

      // Deactivate previous active version
      await this.update(
        { assetMasterId, isActive: true },
        { isActive: false, updatedBy: createdBy },
        entityManager,
      );

      // Convert date strings to Date objects for entity
      const entityData: Partial<AssetVersionEntity> = {
        ...createAssetVersionDto,
        isActive: true,
        createdBy,
        calibrationStartDate: createAssetVersionDto.calibrationStartDate
          ? new Date(createAssetVersionDto.calibrationStartDate)
          : undefined,
        calibrationEndDate: createAssetVersionDto.calibrationEndDate
          ? new Date(createAssetVersionDto.calibrationEndDate)
          : undefined,
        purchaseDate: createAssetVersionDto.purchaseDate
          ? new Date(createAssetVersionDto.purchaseDate)
          : undefined,
        warrantyStartDate: createAssetVersionDto.warrantyStartDate
          ? new Date(createAssetVersionDto.warrantyStartDate)
          : undefined,
        warrantyEndDate: createAssetVersionDto.warrantyEndDate
          ? new Date(createAssetVersionDto.warrantyEndDate)
          : undefined,
      };

      // Create new active version
      return await this.assetVersionsRepository.create(entityData, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<AssetVersionEntity>) {
    try {
      return await this.assetVersionsRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findActiveVersion(assetMasterId: string): Promise<AssetVersionEntity | null> {
    try {
      return await this.assetVersionsRepository.findOne({
        where: { assetMasterId, isActive: true },
      });
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: FindManyOptions<AssetVersionEntity>) {
    try {
      return await this.assetVersionsRepository.findAll(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<AssetVersionEntity>) {
    try {
      const assetVersion = await this.assetVersionsRepository.findOne(findOptions);
      if (!assetVersion) {
        throw new NotFoundException(ASSET_VERSION_ERRORS.ASSET_VERSION_NOT_FOUND);
      }
      return assetVersion;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetVersionEntity>,
    updateData: Partial<AssetVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      await this.assetVersionsRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        AssetVersionEntityFields.ASSET_VERSION,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<AssetVersionEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.assetVersionsRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        AssetVersionEntityFields.ASSET_VERSION,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
