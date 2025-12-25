import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindOptionsWhere,
  FindManyOptions,
} from 'typeorm';
import { BonusEntity } from './entities/bonus.entity';
import { GetBonusDto } from './dto';
import { SortOrder, DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class BonusRepository {
  constructor(
    @InjectRepository(BonusEntity)
    private readonly repository: Repository<BonusEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(data: Partial<BonusEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.save(data);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<BonusEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllInternal(options: FindManyOptions<BonusEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: GetBonusDto, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      const {
        pageSize,
        page,
        sortOrder,
        sortField,
        userId,
        bonusType,
        status,
        applicableMonth,
        applicableYear,
      } = options;

      const queryBuilder = repo
        .createQueryBuilder('bonus')
        .leftJoinAndSelect('bonus.user', 'user')
        .select([
          'bonus',
          'user.id',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.employeeId',
        ])
        .where('bonus.isActive = :isActive', { isActive: true });

      if (userId) {
        queryBuilder.andWhere('bonus.userId = :userId', { userId });
      }

      if (bonusType) {
        queryBuilder.andWhere('bonus.bonusType = :bonusType', { bonusType });
      }

      if (status) {
        queryBuilder.andWhere('bonus.status = :status', { status });
      }

      if (applicableMonth) {
        queryBuilder.andWhere('bonus.applicableMonth = :applicableMonth', { applicableMonth });
      }

      if (applicableYear) {
        queryBuilder.andWhere('bonus.applicableYear = :applicableYear', { applicableYear });
      }

      const [records, totalRecords] = await queryBuilder
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .orderBy(
          `bonus.${sortField || DefaultPaginationValues.SORT_FIELD}`,
          (sortOrder as SortOrder) || SortOrder.DESC,
        )
        .getManyAndCount();

      return this.utilityService.listResponse(records, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<BonusEntity>,
    updateData: Partial<BonusEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(identifierConditions: FindOptionsWhere<BonusEntity>, entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.delete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[] = [], entityManager?: EntityManager) {
    try {
      const repo = entityManager ? entityManager.getRepository(BonusEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
