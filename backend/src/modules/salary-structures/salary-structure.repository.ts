import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { SalaryStructureEntity } from './entities/salary-structure.entity';
import { GetSalaryStructureDto } from './dto';
import { SortOrder, DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class SalaryStructureRepository {
  constructor(
    @InjectRepository(SalaryStructureEntity)
    private readonly repository: Repository<SalaryStructureEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(data: Partial<SalaryStructureEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      return await repo.save(data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<SalaryStructureEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: GetSalaryStructureDto, entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      const { pageSize, page, sortOrder, sortField, userId, isActive, asOfDate, includeHistory } =
        options;

      const queryBuilder = repo
        .createQueryBuilder('salary')
        .leftJoinAndSelect('salary.user', 'user')
        .leftJoinAndSelect('salary.createdByUser', 'createdByUser')
        .leftJoinAndSelect('salary.updatedByUser', 'updatedByUser')
        .select([
          'salary',
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.employeeId',
          'createdByUser.id',
          'createdByUser.firstName',
          'createdByUser.lastName',
          'createdByUser.email',
          'createdByUser.employeeId',
          'updatedByUser.id',
          'updatedByUser.firstName',
          'updatedByUser.lastName',
          'updatedByUser.email',
          'updatedByUser.employeeId',
        ]);

      if (userId) {
        queryBuilder.andWhere('salary.userId = :userId', { userId });
      }

      if (isActive !== undefined) {
        queryBuilder.andWhere('salary.isActive = :isActive', { isActive });
      }

      if (asOfDate) {
        queryBuilder.andWhere('salary.effectiveFrom <= :asOfDate', { asOfDate });
        queryBuilder.andWhere('(salary.effectiveTo IS NULL OR salary.effectiveTo >= :asOfDate)', {
          asOfDate,
        });
      }

      if (includeHistory) {
        queryBuilder.leftJoinAndSelect('salary.changeLogs', 'logs');
      }

      const [records, totalRecords] = await queryBuilder
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .orderBy(
          `salary.${sortField || DefaultPaginationValues.SORT_FIELD}`,
          (sortOrder as SortOrder) || SortOrder.DESC,
        )
        .getManyAndCount();

      return this.utilityService.listResponse(records, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<SalaryStructureEntity>,
    updateData: Partial<SalaryStructureEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      return await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<SalaryStructureEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      return await repo.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = [], entityManager?: EntityManager) {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SalaryStructureEntity)
        : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
