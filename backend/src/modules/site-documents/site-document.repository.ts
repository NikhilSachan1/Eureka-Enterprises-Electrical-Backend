import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { SiteDocumentEntity } from './entities/site-document.entity';

@Injectable()
export class SiteDocumentRepository {
  constructor(
    @InjectRepository(SiteDocumentEntity)
    private readonly repository: Repository<SiteDocumentEntity>,
  ) {}

  async create(
    createData: Partial<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteDocumentEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      const document = repo.create(createData);
      return await repo.save(document);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteDocumentEntity | null> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteDocumentEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<SiteDocumentEntity>,
    updateData: Partial<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<SiteDocumentEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteDocumentEntity)
        : this.repository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
