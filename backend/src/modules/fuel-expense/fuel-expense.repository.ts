import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { FuelExpenseEntity } from './entities/fuel-expense.entity';

@Injectable()
export class FuelExpenseRepository {
  constructor(
    @InjectRepository(FuelExpenseEntity)
    private readonly repository: Repository<FuelExpenseEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(fuelExpense: Partial<FuelExpenseEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseEntity)
        : this.repository;
      return await repository.save(fuelExpense);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<FuelExpenseEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<FuelExpenseEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseEntity)
        : this.repository;
      return await repository.findAndCount(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<FuelExpenseEntity>,
    updateData: Partial<FuelExpenseEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseEntity)
        : this.repository;
      return await repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
