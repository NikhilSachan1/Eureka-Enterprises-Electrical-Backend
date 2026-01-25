import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { CompanyEntity } from './entities/company.entity';

@Injectable()
export class CompanyRepository {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly repository: Repository<CompanyEntity>,
  ) {}

  async create(
    createData: Partial<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<CompanyEntity> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      const company = repo.create(createData);
      return await repo.save(company);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<CompanyEntity | null> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<CompanyEntity[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<CompanyEntity>,
    updateData: Partial<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<CompanyEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager): Promise<any> {
    try {
      const repo = entityManager ? entityManager.getRepository(CompanyEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
