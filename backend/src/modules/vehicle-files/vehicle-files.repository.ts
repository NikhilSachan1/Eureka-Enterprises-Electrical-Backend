import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { VehicleFileEntity } from './entities/vehicle-file.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class VehicleFilesRepository {
  constructor(
    @InjectRepository(VehicleFileEntity)
    private readonly repository: Repository<VehicleFileEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(vehicles: Partial<VehicleFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleFileEntity)
        : this.repository;
      return await repository.save(vehicles);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<VehicleFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleFileEntity)
        : this.repository;
      const [vehicles, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(vehicles, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<VehicleFileEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleFileEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
