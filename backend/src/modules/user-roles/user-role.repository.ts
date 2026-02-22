import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';

@Injectable()
export class UserRoleRepository {
  constructor(
    @InjectRepository(UserRoleEntity)
    private repository: Repository<UserRoleEntity>,
  ) {}

  async create(userRole: Partial<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;
      return await repository.save(userRole);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserRoleEntity>,
    updateData: Partial<UserRoleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;
      return await repository.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDeleteByUserId(userId: string, deletedBy: string, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;

      // Use query builder for proper NULL handling
      const result = await repository
        .createQueryBuilder()
        .update(UserRoleEntity)
        .set({ deletedAt: new Date(), deletedBy })
        .where('"userId" = :userId', { userId })
        .andWhere('"deletedAt" IS NULL')
        .execute();

      return { affected: result.affected || 0 };
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async hardDeleteByUserId(userId: string, entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;

      // Hard delete all user roles (including soft-deleted) to avoid unique constraint issues
      return await repository
        .createQueryBuilder()
        .delete()
        .from(UserRoleEntity)
        .where('"userId" = :userId', { userId })
        .execute();
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async createBulk(userRoles: Partial<UserRoleEntity>[], entityManager?: EntityManager) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserRoleEntity)
        : this.repository;
      return await repository.save(userRoles);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
