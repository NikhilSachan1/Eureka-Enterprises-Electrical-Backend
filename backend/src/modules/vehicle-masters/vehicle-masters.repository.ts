import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { VehicleMasterEntity } from './entities/vehicle-master.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class VehicleMastersRepository {
  constructor(
    @InjectRepository(VehicleMasterEntity)
    private readonly repository: Repository<VehicleMasterEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(vehicles: Partial<VehicleMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleMasterEntity)
        : this.repository;
      return await repository.save(vehicles);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<VehicleMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleMasterEntity)
        : this.repository;
      const [vehicles, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(vehicles, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<VehicleMasterEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleMasterEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    updateData: Partial<VehicleMasterEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleMasterEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleMasterEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleMasterEntity)
        : this.repository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = []): Promise<any | any[]> {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
