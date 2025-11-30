import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindManyOptions, Repository } from 'typeorm';
import { FuelExpenseFilesEntity } from './entities/fuel-expense-files.entity';

/**
 * Fuel Expense Files Repository
 * Handles database operations for fuel expense file attachments
 */
@Injectable()
export class FuelExpenseFilesRepository {
  constructor(
    @InjectRepository(FuelExpenseFilesEntity)
    private readonly repository: Repository<FuelExpenseFilesEntity>,
  ) {}

  /**
   * Create a new fuel expense file record
   */
  async create(fuelExpenseFile: Partial<FuelExpenseFilesEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseFilesEntity)
        : this.repository;
      return await repository.save(fuelExpenseFile);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Find multiple fuel expense file records
   */
  async findAll(options: FindManyOptions<FuelExpenseFilesEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(FuelExpenseFilesEntity)
        : this.repository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
