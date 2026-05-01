import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { OrgFileNodeEntity } from './entities/org-file-node.entity';

@Injectable()
export class OrgFilesRepository {
  constructor(
    @InjectRepository(OrgFileNodeEntity)
    private readonly repository: Repository<OrgFileNodeEntity>,
  ) {}

  async create(
    data: Partial<OrgFileNodeEntity>,
    entityManager?: EntityManager,
  ): Promise<OrgFileNodeEntity> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      return await repo.save(repo.create(data));
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<OrgFileNodeEntity>,
    entityManager?: EntityManager,
  ): Promise<OrgFileNodeEntity | null> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<OrgFileNodeEntity>,
    entityManager?: EntityManager,
  ): Promise<OrgFileNodeEntity[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    conditions: FindOptionsWhere<OrgFileNodeEntity>,
    data: Partial<OrgFileNodeEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      await repo.update(conditions, data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    conditions: FindOptionsWhere<OrgFileNodeEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      await repo.softDelete(conditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(
    query: string,
    params: any[],
    entityManager?: EntityManager,
  ): Promise<any[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(OrgFileNodeEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
