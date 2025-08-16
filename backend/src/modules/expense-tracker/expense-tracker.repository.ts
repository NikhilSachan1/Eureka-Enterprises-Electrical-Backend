import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UtilityService } from 'src/utils/utility/utility.service';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { ExpenseTrackerEntity } from './entities/expense-tracker.entity';

@Injectable()
export class ExpenseTrackerRepository {
  constructor(
    @InjectRepository(ExpenseTrackerEntity)
    private readonly repository: Repository<ExpenseTrackerEntity>,
    private readonly utilityService: UtilityService,
  ) {}
  async create(expense: Partial<ExpenseTrackerEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ExpenseTrackerEntity)
        : this.repository;
      return await repository.save(expense);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<ExpenseTrackerEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ExpenseTrackerEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<ExpenseTrackerEntity>,
    updateData: Partial<ExpenseTrackerEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ExpenseTrackerEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
