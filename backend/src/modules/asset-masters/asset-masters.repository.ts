import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { AssetMasterEntity } from './entities/asset-master.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class AssetMastersRepository {
  constructor(
    @InjectRepository(AssetMasterEntity)
    private readonly repository: Repository<AssetMasterEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(assets: Partial<AssetMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetMasterEntity)
        : this.repository;
      return await repository.save(assets);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<AssetMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetMasterEntity)
        : this.repository;
      const [assets, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(assets, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AssetMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetMasterEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    updateData: Partial<AssetMasterEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetMasterEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetMasterEntity)
        : this.repository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = []): Promise<any | any[]> {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
