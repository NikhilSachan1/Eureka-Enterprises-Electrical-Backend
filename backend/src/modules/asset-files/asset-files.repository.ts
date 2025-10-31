import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { AssetFileEntity } from './entities/asset-file.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class AssetFilesRepository {
  constructor(
    @InjectRepository(AssetFileEntity)
    private readonly repository: Repository<AssetFileEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(assets: Partial<AssetFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetFileEntity)
        : this.repository;
      return await repository.save(assets);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<AssetFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetFileEntity)
        : this.repository;
      const [assets, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(assets, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<AssetFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(AssetFileEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
