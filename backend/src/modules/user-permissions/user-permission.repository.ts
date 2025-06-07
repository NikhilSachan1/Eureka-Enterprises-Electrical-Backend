import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { CreateUserPermissionDto } from './dto/user-permission.dto';

@Injectable()
export class UserPermissionRepository {
  constructor(
    @InjectRepository(UserPermissionEntity)
    private readonly repository: Repository<UserPermissionEntity>,
  ) {}

  async create(
    userPermission: CreateUserPermissionDto,
    entityManager?: EntityManager,
  ): Promise<UserPermissionEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserPermissionEntity)
        : this.repository;
      return await repository.save(userPermission);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: { where?: any; relations?: string[] }): Promise<UserPermissionEntity[]> {
    try {
      return await this.repository.find({
        ...options,
        where: { ...options.where, deletedAt: null },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<UserPermissionEntity>,
  ): Promise<UserPermissionEntity | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserPermissionEntity>,
    updateData: Partial<UserPermissionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(UserPermissionEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, parameters: any[] = []): Promise<any> {
    try {
      return await this.repository.query(query, parameters);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
