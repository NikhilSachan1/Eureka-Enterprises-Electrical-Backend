import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { VehicleServiceFileEntity } from './entities/vehicle-service-file.entity';

@Injectable()
export class VehicleServiceFilesRepository {
  constructor(
    @InjectRepository(VehicleServiceFileEntity)
    private readonly repository: Repository<VehicleServiceFileEntity>,
  ) {}

  async create(
    data: Partial<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceFileEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceFileEntity)
        : this.repository;
      const entity = repo.create(data);
      return await repo.save(entity);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceFileEntity | null> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceFileEntity)
        : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<VehicleServiceFileEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceFileEntity)
        : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleServiceFileEntity>,
    updateData: Partial<VehicleServiceFileEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceFileEntity)
        : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleServiceFileEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(VehicleServiceFileEntity)
        : this.repository;
      await repo.update(identifierConditions, { deletedAt: new Date(), deletedBy });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
