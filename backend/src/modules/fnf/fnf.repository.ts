import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { FnfEntity } from './entities/fnf.entity';
import { FnfQueryDto } from './dto';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { FnfSortFields } from './constants/fnf.constants';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Injectable()
export class FnfRepository {
  constructor(
    @InjectRepository(FnfEntity)
    private readonly repository: Repository<FnfEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(fnf: Partial<FnfEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      return await repository.save(fnf);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<FnfEntity> & FnfQueryDto, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      const queryOptions = options.where as any;
      const {
        page,
        pageSize,
        sortField,
        sortOrder,
        userId,
        status,
        exitReason,
        exitDateFrom,
        exitDateTo,
      } = queryOptions;

      const queryBuilder = repository.createQueryBuilder('fnf');

      // Join all user relations for details
      queryBuilder.leftJoinAndSelect('fnf.user', 'user');
      queryBuilder.leftJoinAndSelect('fnf.calculatedByUser', 'calculatedByUser');
      queryBuilder.leftJoinAndSelect('fnf.approvedByUser', 'approvedByUser');
      queryBuilder.leftJoinAndSelect('fnf.completedByUser', 'completedByUser');
      queryBuilder.leftJoinAndSelect('fnf.createdByUser', 'createdByUser');
      queryBuilder.leftJoinAndSelect('fnf.updatedByUser', 'updatedByUser');

      // Filter out deleted records
      queryBuilder.where('fnf.deletedAt IS NULL');

      // Apply filters
      if (userId) {
        queryBuilder.andWhere('fnf.userId = :userId', { userId });
      }

      if (status) {
        queryBuilder.andWhere('fnf.status = :status', { status });
      }

      if (exitReason) {
        queryBuilder.andWhere('fnf.exitReason = :exitReason', { exitReason });
      }

      if (exitDateFrom) {
        queryBuilder.andWhere('fnf.exitDate >= :exitDateFrom', { exitDateFrom });
      }

      if (exitDateTo) {
        queryBuilder.andWhere('fnf.exitDate <= :exitDateTo', { exitDateTo });
      }

      // Apply sorting
      const validSortField = sortField || FnfSortFields.CREATED_AT;
      queryBuilder.orderBy(`fnf.${validSortField}`, (sortOrder as SortOrder) || 'DESC');

      // Apply pagination
      if (page && pageSize) {
        queryBuilder.skip((page - 1) * pageSize);
        queryBuilder.take(pageSize);
      }

      const [records, total] = await queryBuilder.getManyAndCount();

      // Map user details
      const formatUserDetails = (userEntity: UserEntity | null) =>
        userEntity
          ? {
              id: userEntity.id,
              firstName: userEntity.firstName,
              lastName: userEntity.lastName,
              email: userEntity.email,
            }
          : null;

      const mappedRecords = records.map((record) => ({
        ...record,
        user: record.user
          ? {
              id: record.user.id,
              firstName: record.user.firstName,
              lastName: record.user.lastName,
              email: record.user.email,
              employeeId: record.user.employeeId,
              designation: record.user.designation,
            }
          : null,
        calculatedByUser: formatUserDetails(record.calculatedByUser),
        approvedByUser: formatUserDetails(record.approvedByUser),
        completedByUser: formatUserDetails(record.completedByUser),
        createdByUser: formatUserDetails(record.createdByUser),
        updatedByUser: formatUserDetails(record.updatedByUser),
      }));

      return this.utilityService.listResponse(mappedRecords, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<FnfEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      const whereConditions = options.where as FindOptionsWhere<FnfEntity>;
      return await repository.findOne({
        ...options,
        where: {
          ...whereConditions,
          deletedAt: null,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<FnfEntity>,
    updateData: Partial<FnfEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<FnfEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      return await repository.update(identifierConditions, {
        deletedAt: new Date(),
        deletedBy,
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(FnfEntity) : this.repository;
      return await repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
