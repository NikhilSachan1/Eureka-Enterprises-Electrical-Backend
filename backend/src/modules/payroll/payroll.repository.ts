import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { PayrollEntity } from './entities/payroll.entity';
import { GetPayrollDto } from './dto';
import { SortOrder, DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class PayrollRepository {
  constructor(
    @InjectRepository(PayrollEntity)
    private readonly repository: Repository<PayrollEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(data: Partial<PayrollEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      return await repo.save(data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<PayrollEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: GetPayrollDto, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      const { pageSize, page, sortOrder, sortField, userId, month, year, status } = options;

      const queryBuilder = repo
        .createQueryBuilder('payroll')
        .leftJoinAndSelect('payroll.user', 'user')
        .leftJoinAndSelect('payroll.salaryStructure', 'salary')
        .select([
          'payroll',
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.employeeId',
          'salary.id',
          'salary.grossSalary',
          'salary.netSalary',
        ]);

      if (userId) {
        queryBuilder.andWhere('payroll.userId = :userId', { userId });
      }

      if (month) {
        queryBuilder.andWhere('payroll.month = :month', { month });
      }

      if (year) {
        queryBuilder.andWhere('payroll.year = :year', { year });
      }

      if (status) {
        queryBuilder.andWhere('payroll.status = :status', { status });
      }

      const [records, totalRecords] = await queryBuilder
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .orderBy(
          `payroll.${sortField || DefaultPaginationValues.SORT_FIELD}`,
          (sortOrder as SortOrder) || SortOrder.DESC,
        )
        .getManyAndCount();

      return this.utilityService.listResponse(records, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<PayrollEntity>,
    updateData: Partial<PayrollEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      return await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<PayrollEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      return await repo.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = [], entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(PayrollEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
