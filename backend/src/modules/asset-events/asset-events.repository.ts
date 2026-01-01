import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { AssetEventEntity } from './entities/asset-event.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class AssetEventsRepository {
  constructor(
    @InjectRepository(AssetEventEntity)
    private readonly repository: Repository<AssetEventEntity>,
    private readonly utilityService: UtilityService,
    private readonly dataSource: DataSource,
  ) {}
  async create(assetEvents: Partial<AssetEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetEventEntity)
        : this.repository;
      return await repository.save(assetEvents);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<AssetEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetEventEntity)
        : this.repository;
      const [assetEvents, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(assetEvents, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AssetEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetEventEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[]) {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
