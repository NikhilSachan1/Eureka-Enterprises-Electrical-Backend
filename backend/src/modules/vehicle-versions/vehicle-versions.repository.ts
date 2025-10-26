import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { VehicleVersionEntity } from './entities/vehicle-versions.entity';
import { UtilityService } from 'src/utils/utility/utility.service';
import { VehicleVersionsQueryDto } from './dto';

@Injectable()
export class VehicleVersionsRepository {
  constructor(
    @InjectRepository(VehicleVersionEntity)
    private readonly repository: Repository<VehicleVersionEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(vehicles: Partial<VehicleVersionEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleVersionEntity)
        : this.repository;
      return await repository.save(vehicles);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<VehicleVersionEntity> & VehicleVersionsQueryDto,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleVersionEntity)
        : this.repository;
      const [vehicles, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(vehicles, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<VehicleVersionEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleVersionEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<VehicleVersionEntity>,
    updateData: Partial<VehicleVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleVersionEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<VehicleVersionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleVersionEntity)
        : this.repository;
      return await repository.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
