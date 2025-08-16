import { Injectable } from '@nestjs/common';
import { ExpenseFilesRepository } from './expense-files.repository';
import { EntityManager } from 'typeorm';

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
}
