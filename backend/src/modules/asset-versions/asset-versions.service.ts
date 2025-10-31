import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAssetDto } from './dto';
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
    createAssetDto: CreateAssetDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { createdBy, number, assetMasterId } = createAssetDto;
      await this.update({ number, assetMasterId }, { isActive: false, updatedBy: createdBy });
      return await this.assetVersionsRepository.create(
        { ...createAssetDto, createdBy },
        entityManager,
      );
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

  async findAll(findOptions: FindManyOptions<AssetVersionEntity>) {
    try {
      return await this.assetVersionsRepository.findAll(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(findOptions: FindOneOptions<AssetVersionEntity>) {
    try {
      const asset = await this.assetVersionsRepository.findOne(findOptions);
      if (!asset) {
        throw new NotFoundException(ASSET_VERSION_ERRORS.ASSET_NOT_FOUND);
      }
      return asset;
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
        AssetVersionEntityFields.ASSET,
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
        AssetVersionEntityFields.ASSET,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }
}
