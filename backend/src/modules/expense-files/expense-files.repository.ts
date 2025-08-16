import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ExpenseFilesEntity } from './entities/expense-files.entity';

@Injectable()
export class ExpenseFilesRepository {
  constructor(
    @InjectRepository(ExpenseFilesEntity)
    private readonly repository: Repository<ExpenseFilesEntity>,
  ) {}
  async create(expenseFiles: Partial<ExpenseFilesEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ExpenseFilesEntity)
        : this.repository;
      return await repository.save(expenseFiles);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
