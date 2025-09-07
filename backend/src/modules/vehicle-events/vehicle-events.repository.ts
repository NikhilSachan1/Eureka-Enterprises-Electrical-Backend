import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { VehicleEventEntity } from './entities/vehicle-event.entity';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class VehicleEventsRepository {
  constructor(
    @InjectRepository(VehicleEventEntity)
    private readonly repository: Repository<VehicleEventEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(vehicleEvents: Partial<VehicleEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleEventEntity)
        : this.repository;
      return await repository.save(vehicleEvents);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<VehicleEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleEventEntity)
        : this.repository;
      const [vehicleEvents, total] = await repository.findAndCount(options);
      return this.utilityService.listResponse(vehicleEvents, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<VehicleEventEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(VehicleEventEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
