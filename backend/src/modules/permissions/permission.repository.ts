import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionEntity } from './entities/permission.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { CreatePermissionDto } from './dto/permission.dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class PermissionRepository {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repository: Repository<PermissionEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    permission: CreatePermissionDto & { createdBy: string },
    entityManager?: EntityManager,
  ): Promise<PermissionEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(PermissionEntity)
        : this.repository;
      return await repository.save(permission);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<PermissionEntity>): Promise<{
    records: PermissionEntity[];
    totalRecords: number;
  }> {
    try {
      const [permissions, totalRecords] = await this.repository.findAndCount({
        where: { deletedAt: null, ...options.where },
        order: { name: 'ASC' },
      });
      return this.utilityService.listResponse(permissions, totalRecords);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<PermissionEntity>): Promise<PermissionEntity | null> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneOrFail(options: FindOneOptions<PermissionEntity>): Promise<PermissionEntity> {
    try {
      return await this.repository.findOneOrFail(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<PermissionEntity>,
    updateData: Partial<PermissionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(PermissionEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
