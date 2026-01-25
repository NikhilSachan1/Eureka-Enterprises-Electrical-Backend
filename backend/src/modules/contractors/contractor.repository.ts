import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { ContractorEntity } from './entities/contractor.entity';

@Injectable()
export class ContractorRepository {
  constructor(
    @InjectRepository(ContractorEntity)
    private readonly repository: Repository<ContractorEntity>,
  ) {}

  async create(
    createData: Partial<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<ContractorEntity> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      const contractor = repo.create(createData);
      return await repo.save(contractor);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<ContractorEntity | null> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<ContractorEntity[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<ContractorEntity>,
    updateData: Partial<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<ContractorEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager): Promise<any> {
    try {
      const repo = entityManager ? entityManager.getRepository(ContractorEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
