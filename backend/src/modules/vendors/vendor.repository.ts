import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { VendorEntity } from './entities/vendor.entity';

@Injectable()
export class VendorRepository {
  constructor(
    @InjectRepository(VendorEntity)
    private readonly repository: Repository<VendorEntity>,
  ) {}

  async create(
    createData: Partial<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<VendorEntity> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      const vendor = repo.create(createData);
      return await repo.save(vendor);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<VendorEntity | null> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<VendorEntity[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VendorEntity>,
    updateData: Partial<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<VendorEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager): Promise<any> {
    try {
      const repo = entityManager ? entityManager.getRepository(VendorEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
