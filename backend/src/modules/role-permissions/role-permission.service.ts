import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { RolePermissionRepository } from './role-permission.repository';
import { EntityManager, FindOptionsWhere } from 'typeorm';
import { RolePermissionEntity } from './entities/role-permission.entity';
import {
  CreateRolePermissionDto,
  BulkCreateRolePermissionsDto,
  DeleteRolePermissionDto,
  BulkDeleteRolePermissionsDto,
} from './dto';
import {
  ROLE_PERMISSION_ERRORS,
  ROLE_PERMISSION_SUCCESS_MESSAGES,
} from './constants/role-permission.constants';
import { RoleService } from '../roles/role.service';
import { PermissionService } from '../permissions/permission.service';

@Injectable()
export class RolePermissionService {
  constructor(
    private readonly rolePermissionRepository: RolePermissionRepository,
    private readonly rolesService: RoleService,
    private readonly permissionsService: PermissionService,
  ) {}

  async create(
    { permissionId, isActive, roleId }: CreateRolePermissionDto & { roleId: string },
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity> {
    await this.validatePermissionExists(permissionId);

    const whereClause = { roleId, permissionId, deletedAt: null };
    const existing = await this.rolePermissionRepository.findOne({ where: whereClause });

    if (existing) {
      if (existing.isActive === isActive) {
        throw new BadRequestException(ROLE_PERMISSION_ERRORS.ALREADY_EXISTS);
      }

      await this.rolePermissionRepository.update(whereClause, {
        isActive,
        updatedAt: new Date(),
      });

      return this.rolePermissionRepository.findOne({ where: whereClause });
    }

    return this.rolePermissionRepository.create({ roleId, permissionId, isActive }, entityManager);
  }

  async bulkCreate(
    { roleId, rolePermissions }: BulkCreateRolePermissionsDto,
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity[]> {
    const results: RolePermissionEntity[] = [];
    await this.validateRoleExists(roleId);

    for (const { permissionId, isActive } of rolePermissions) {
      try {
        const result = await this.create(
          {
            roleId,
            permissionId,
            isActive,
          },
          entityManager,
        );
        results.push(result);
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          throw error;
        }
      }
    }

    return results;
  }

  async findAll(options: FindOptionsWhere<RolePermissionEntity>): Promise<{
    records: RolePermissionEntity[];
    totalRecords: number;
  }> {
    try {
      return await this.rolePermissionRepository.findAll(options);
    } catch (error) {
      throw error;
    }
  }

  async delete(
    { roleId, permissionId }: DeleteRolePermissionDto,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<{ message: string }> {
    await this.validateRoleExists(roleId);
    await this.validatePermissionExists(permissionId);

    const existing = await this.rolePermissionRepository.findOne({
      where: {
        roleId,
        permissionId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(ROLE_PERMISSION_ERRORS.NOT_FOUND);
    }
    await this.rolePermissionRepository.delete(existing.id, deletedBy, entityManager);

    return { message: ROLE_PERMISSION_SUCCESS_MESSAGES.DELETED };
  }

  async bulkDelete(
    { roleId, permissionIds }: BulkDeleteRolePermissionsDto,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<{ message: string }> {
    await this.validateRoleExists(roleId);
    for (const permissionId of permissionIds) {
      await this.validatePermissionExists(permissionId);
    }
    for (const permissionId of permissionIds) {
      await this.delete({ roleId, permissionId }, deletedBy, entityManager);
    }

    return {
      message: ROLE_PERMISSION_SUCCESS_MESSAGES.DELETED,
    };
  }

  private async validateRoleExists(roleId: string): Promise<void> {
    await this.rolesService.findOneOrFail({ where: { id: roleId, deletedAt: null } });
  }

  private async validatePermissionExists(permissionId: string): Promise<void> {
    await this.permissionsService.findOneOrFail({ where: { id: permissionId, deletedAt: null } });
  }
}
