import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { GetUsersDto, CreateUserDto } from './dto';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { UserStatus } from './constants/user.constants';
import { UserMetrics } from './user.types';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
    private utilityService: UtilityService,
  ) {}

  async findAll(
    options: GetUsersDto,
  ): Promise<{ records: UserEntity[] | any[]; totalRecords: number } | undefined> {
    try {
      const { pageSize, page, sortOrder, sortField, role, search, ...whereCondition } = options;

      const queryBuilder = this.repository
        .createQueryBuilder('users')
        .leftJoinAndSelect('users.userRoles', 'user-roles')
        .leftJoinAndSelect('user-roles.role', 'role')
        .select([
          'users.id',
          'users.employeeId',
          'users.firstName',
          'users.lastName',
          'users.email',
          'users.contactNumber',
          'users.status',
          'users.profilePicture',
          'users.designation',
          'users.employeeType',
          'users.dateOfJoining',
          'users.createdAt',
          'users.updatedAt',
          'user-roles.id',
          'role.name',
        ]);

      if (Object.keys(whereCondition).length > 0) {
        Object.entries(whereCondition).forEach(([key, value]) => {
          if (value) {
            // Handle array values with IN clause (e.g., status filter)
            if (Array.isArray(value)) {
              queryBuilder.andWhere(`users.${key} IN (:...${key})`, { [key]: value });
            } else {
              queryBuilder.andWhere(`users.${key} = :${key}`, { [key]: value });
            }
          }
        });
      }

      if (search) {
        queryBuilder.andWhere(
          `(LOWER(CONCAT(users.firstName, ' ', users.lastName)) LIKE LOWER(:search) OR LOWER(users.email) LIKE LOWER(:search))`,
          { search: `%${search}%` },
        );
      }

      if (role && role.length > 0) {
        queryBuilder.andWhere('role.name IN (:...roleNames)', { roleNames: role });
      }

      const [users, count] = await queryBuilder
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .orderBy(`users.${sortField}`, sortOrder as SortOrder)
        .getManyAndCount();

      const transformedUsers = users.map((user) => {
        const userWithoutRoles = Object.fromEntries(
          Object.entries(user).filter(([key]) => key !== 'userRoles'),
        );

        return {
          ...userWithoutRoles,
          role: user.userRoles?.length > 0 ? { name: user.userRoles[0].role.name } : null,
        };
      });

      return this.utilityService.listResponse(transformedUsers, count);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: any) {
    try {
      return this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async create(user: CreateUserDto, entityManager?: EntityManager): Promise<UserEntity> {
    try {
      const repository = entityManager ? entityManager.getRepository(UserEntity) : this.repository;
      return repository.save(user);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserEntity>,
    updateData: Partial<UserEntity>,
  ) {
    try {
      const updateResult = await this.repository.update(identifierConditions, updateData);
      return updateResult;
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  delete(id: string, deletedBy: string, entityManager?: EntityManager) {
    try {
      const repository = entityManager ? entityManager.getRepository(UserEntity) : this.repository;
      repository.update(id, { deletedBy });
      return repository.softDelete(id);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async rawQuery(query: any, params?: any | any[]) {
    try {
      return await this.repository.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getMetrics(): Promise<UserMetrics> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get all counts in a single optimized query
      const metricsQuery = this.repository
        .createQueryBuilder('users')
        .select([
          'COUNT(*) as total',
          `SUM(CASE WHEN users.status = '${UserStatus.ACTIVE}' THEN 1 ELSE 0 END) as active`,
          `SUM(CASE WHEN users.status = '${UserStatus.ARCHIVED}' THEN 1 ELSE 0 END) as inactive`,
          `SUM(CASE WHEN users.dateOfJoining >= :thirtyDaysAgo THEN 1 ELSE 0 END) as "newJoinersLast30Days"`,
        ])
        .setParameter('thirtyDaysAgo', thirtyDaysAgo);

      const [mainMetrics] = await metricsQuery.getRawMany();

      // Get counts by employee type
      const employeeTypeMetrics = await this.repository
        .createQueryBuilder('users')
        .select(['users.employeeType as type', 'COUNT(*) as count'])
        .where('users.employeeType IS NOT NULL')
        .groupBy('users.employeeType')
        .getRawMany();

      // Get counts by designation
      const designationMetrics = await this.repository
        .createQueryBuilder('users')
        .select(['users.designation as type', 'COUNT(*) as count'])
        .where('users.designation IS NOT NULL')
        .groupBy('users.designation')
        .getRawMany();

      // Get counts by gender
      const genderMetrics = await this.repository
        .createQueryBuilder('users')
        .select(['users.gender as type', 'COUNT(*) as count'])
        .where('users.gender IS NOT NULL')
        .groupBy('users.gender')
        .getRawMany();

      // Transform array results to Record objects
      const byEmployeeType: Record<string, number> = {};
      employeeTypeMetrics.forEach((item) => {
        byEmployeeType[item.type] = parseInt(item.count);
      });

      const byDesignation: Record<string, number> = {};
      designationMetrics.forEach((item) => {
        byDesignation[item.type] = parseInt(item.count);
      });

      const byGender: Record<string, number> = {};
      genderMetrics.forEach((item) => {
        byGender[item.type] = parseInt(item.count);
      });

      return {
        total: parseInt(mainMetrics.total) || 0,
        active: parseInt(mainMetrics.active) || 0,
        inactive: parseInt(mainMetrics.inactive) || 0,
        newJoinersLast30Days: parseInt(mainMetrics.newJoinersLast30Days) || 0,
        byEmployeeType,
        byDesignation,
        byGender,
      };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
