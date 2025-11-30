import { Injectable } from '@nestjs/common';
import { FuelExpenseFilesRepository } from './fuel-expense-files.repository';
import { EntityManager, FindManyOptions } from 'typeorm';
import { FuelExpenseFilesEntity } from './entities/fuel-expense-files.entity';

/**
 * Fuel Expense Files Service
 * Handles business logic for fuel expense file attachments
 */
@Injectable()
export class FuelExpenseFilesService {
  constructor(private readonly fuelExpenseFilesRepository: FuelExpenseFilesRepository) {}

  /**
   * Create fuel expense file records
   * @param createFuelExpenseFiles - Object containing fuelExpenseId, fileKeys, and createdBy
   * @param entityManager - Optional transaction entity manager
   */
  async create(
    createFuelExpenseFiles: {
      fuelExpenseId: string;
      fileKeys: string[];
      createdBy: string;
    },
    entityManager?: EntityManager,
  ) {
    try {
      const { fuelExpenseId, fileKeys, createdBy } = createFuelExpenseFiles;

      // Create a file record for each file key
      for (const fileKey of fileKeys) {
        await this.fuelExpenseFilesRepository.create(
          {
            fuelExpenseId,
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

  /**
   * Find all fuel expense files matching the given options
   * @param options - Find options for querying files
   * @param entityManager - Optional transaction entity manager
   */
  async findAll(options: FindManyOptions<FuelExpenseFilesEntity>, entityManager?: EntityManager) {
    try {
      return await this.fuelExpenseFilesRepository.findAll(options, entityManager);
    } catch (error) {
      throw error;
    }
  }
}
