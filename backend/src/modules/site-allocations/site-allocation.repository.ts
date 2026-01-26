import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
  EntityManager,
} from 'typeorm';
import { SiteAllocationEntity } from './entities/site-allocation.entity';

@Injectable()
export class SiteAllocationRepository {
  constructor(
    @InjectRepository(SiteAllocationEntity)
    private readonly repository: Repository<SiteAllocationEntity>,
  ) {}

  async create(
    data: Partial<SiteAllocationEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteAllocationEntity> {
    const repo = entityManager
      ? entityManager.getRepository(SiteAllocationEntity)
      : this.repository;
    const entity = repo.create(data);
    return await repo.save(entity);
  }

  async findOne(
    options: FindOneOptions<SiteAllocationEntity>,
  ): Promise<SiteAllocationEntity | null> {
    return await this.repository.findOne(options);
  }

  async findAll(options: FindManyOptions<SiteAllocationEntity>): Promise<SiteAllocationEntity[]> {
    return await this.repository.find(options);
  }

  async update(
    criteria: FindOptionsWhere<SiteAllocationEntity>,
    data: Partial<SiteAllocationEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repo = entityManager
      ? entityManager.getRepository(SiteAllocationEntity)
      : this.repository;
    await repo.update(criteria, data);
  }

  async softDelete(
    criteria: FindOptionsWhere<SiteAllocationEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repo = entityManager
      ? entityManager.getRepository(SiteAllocationEntity)
      : this.repository;
    await repo.softDelete(criteria);
  }

  async restore(
    criteria: FindOptionsWhere<SiteAllocationEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repo = entityManager
      ? entityManager.getRepository(SiteAllocationEntity)
      : this.repository;
    await repo.restore(criteria);
  }

  async count(options: FindManyOptions<SiteAllocationEntity>): Promise<number> {
    return await this.repository.count(options);
  }
}
