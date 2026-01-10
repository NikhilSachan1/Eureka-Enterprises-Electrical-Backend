import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { SalaryChangeLogEntity } from './entities/salary-change-log.entity';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

@Injectable()
export class SalaryChangeLogRepository {
  constructor(
    @InjectRepository(SalaryChangeLogEntity)
    private readonly repository: Repository<SalaryChangeLogEntity>,
  ) {}

  async create(
    data: {
      salaryStructureId: string;
      changeType: string;
      previousValues?: Record<string, any>;
      newValues: Record<string, any>;
      changedBy: string;
      reason?: string;
    },
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      const entity = repo.create({
        ...data,
        createdBy: data.changedBy,
      });
      return await repo.save(entity);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<SalaryChangeLogEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<SalaryChangeLogEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<SalaryChangeLogEntity>,
    updateData: Partial<SalaryChangeLogEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      return await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<SalaryChangeLogEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      return await repo.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = [], entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  /**
   * Get change history for a salary structure with limited user fields
   * Returns changedByUser with only: id, firstName, lastName, email, employeeId
   * Only the most recent record (first in array) has isActive: true, rest have false
   */
  async getChangeHistoryWithLimitedFields(
    salaryStructureId: string,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryChangeLogEntity)
        : this.repository;

      const logs = await repo
        .createQueryBuilder('log')
        .leftJoin('log.changedByUser', 'changedByUser')
        .select([
          'log.id',
          'log.salaryStructureId',
          'log.changeType',
          'log.previousValues',
          'log.newValues',
          'log.changedBy',
          'log.changedAt',
          'log.reason',
          'log.createdAt',
          'log.updatedAt',
          // Limited user fields
          'changedByUser.id',
          'changedByUser.firstName',
          'changedByUser.lastName',
          'changedByUser.email',
          'changedByUser.employeeId',
        ])
        .where('log.salaryStructureId = :salaryStructureId', { salaryStructureId })
        .orderBy('log.changedAt', SortOrder.DESC)
        .getMany();

      // Mark only the first (most recent) record as active, rest as inactive
      return logs.map((log, index) => ({
        ...log,
        isActive: index === 0,
      }));
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
