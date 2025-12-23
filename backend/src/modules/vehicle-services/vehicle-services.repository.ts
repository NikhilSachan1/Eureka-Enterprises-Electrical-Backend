import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { VehicleServiceEntity } from './entities/vehicle-service.entity';

@Injectable()
export class VehicleServicesRepository {
  constructor(
    @InjectRepository(VehicleServiceEntity)
    private readonly repository: Repository<VehicleServiceEntity>,
  ) {}

  async create(
    data: Partial<VehicleServiceEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceEntity)
        : this.repository;
      const entity = repo.create(data);
      return await repo.save(entity);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<VehicleServiceEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceEntity | null> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceEntity)
        : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<VehicleServiceEntity>,
    entityManager?: EntityManager,
  ): Promise<[VehicleServiceEntity[], number]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceEntity)
        : this.repository;
      return await repo.findAndCount(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleServiceEntity>,
    updateData: Partial<VehicleServiceEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceEntity)
        : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleServiceEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceEntity)
        : this.repository;
      await repo.update(identifierConditions, { deletedAt: new Date(), deletedBy });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[]): Promise<any> {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
