import { Injectable } from '@nestjs/common';
import { ExpenseFilesRepository } from './expense-files.repository';
import { EntityManager, FindManyOptions } from 'typeorm';
import { ExpenseFilesEntity } from './entities/expense-files.entity';

@Injectable()
export class ExpenseFilesService {
  constructor(private readonly expenseFilesRepository: ExpenseFilesRepository) {}

  async create(
    createExpenseFiles: { expenseId: string; fileKeys: string[]; createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const { expenseId, fileKeys, createdBy } = createExpenseFiles;
      for (const fileKey of fileKeys) {
        await this.expenseFilesRepository.create(
          {
            expenseId,
            fileKey,
            createdBy,
          },
          entityManager,
        );
      }
      return true;
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: FindManyOptions<ExpenseFilesEntity>, entityManager?: EntityManager) {
    try {
      return await this.expenseFilesRepository.findAll(options, entityManager);
    } catch (error) {
      throw error;
    }
  }
}
