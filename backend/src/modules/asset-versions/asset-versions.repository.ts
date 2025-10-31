import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { AssetVersionEntity } from './entities/asset-versions.entity';
import { UtilityService } from 'src/utils/utility/utility.service';
import { AssetVersionsQueryDto } from './dto';

@Injectable()
export class AssetVersionsRepository {
  constructor(
    @InjectRepository(AssetVersionEntity)
    private readonly repository: Repository<AssetVersionEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(assets: Partial<AssetVersionEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetVersionEntity)
        : this.repository;
      return await repository.save(assets);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<AssetVersionEntity> & AssetVersionsQueryDto,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetVersionEntity)
        : this.repository;
      const [assets, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(assets, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AssetVersionEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetVersionEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetVersionEntity>,
    updateData: Partial<AssetVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetVersionEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<AssetVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetVersionEntity)
        : this.repository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
