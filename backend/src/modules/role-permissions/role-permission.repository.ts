import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { CreateRolePermissionDto } from './dto/role-permission.dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class RolePermissionRepository {
  constructor(
    @InjectRepository(RolePermissionEntity)
    private readonly repository: Repository<RolePermissionEntity>,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    rolePermission: CreateRolePermissionDto & { roleId: string },
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(RolePermissionEntity)
        : this.repository;
      return await repository.save(rolePermission);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<RolePermissionEntity>,
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity | null> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(RolePermissionEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindOptionsWhere<RolePermissionEntity>): Promise<{
    records: RolePermissionEntity[];
    totalRecords: number;
  }> {
    try {
      const [rolePermissions, total] = await this.repository.findAndCount({
        where: options,
      });
      return this.utilityService.listResponse(rolePermissions, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<RolePermissionEntity>,
    updateData: Partial<RolePermissionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(RolePermissionEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async delete(id: string, deletedBy: string, entityManager?: EntityManager): Promise<void> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(RolePermissionEntity)
        : this.repository;
      await repository.update(id, { deletedBy, deletedAt: new Date() });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
