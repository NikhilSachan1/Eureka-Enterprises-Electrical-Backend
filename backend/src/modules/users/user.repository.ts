import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { GetUsersDto, CreateUserDto } from './dto';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

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
        .leftJoinAndSelect('users.userRoles', 'user_roles')
        .leftJoinAndSelect('user_roles.role', 'role')
        .select([
          'users.id',
          'users.firstName',
          'users.lastName',
          'users.email',
          'users.contactNumber',
          'users.status',
          'users.profilePicture',
          'users.passwordUpdatedAt',
          'users.createdAt',
          'users.updatedAt',
          'users.deletedAt',
          'user_roles.id',
          'role.name',
        ]);

      if (Object.keys(whereCondition).length > 0) {
        Object.entries(whereCondition).forEach(([key, value]) => {
          if (value) {
            queryBuilder.andWhere(`users.${key} = :${key}`, { [key]: value });
          }
        });
      }

      if (search) {
        queryBuilder.andWhere(
          `(LOWER(CONCAT(users.firstName, ' ', users.lastName)) LIKE LOWER(:search) OR LOWER(users.email) LIKE LOWER(:search))`,
          { search: `%${search}%` },
        );
      }

      if (role) {
        queryBuilder.andWhere('role.name = :roleName', { roleName: role });
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
      return entityManager.getRepository(UserEntity).save(user);
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
}
