import { Injectable, BadRequestException } from '@nestjs/common';
import { RolePermissionRepository } from './role-permission.repository';
import { EntityManager } from 'typeorm';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { CreateRolePermissionDto, BulkCreateRolePermissionsDto } from './dto/role-permission.dto';
import { ROLE_PERMISSION_ERRORS } from './constants/role-permission.constants';
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
    createDto: CreateRolePermissionDto,
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity> {
    await this.validateRoleExists(createDto.roleId);
    await this.validatePermissionExists(createDto.permissionId);

    const existing = await this.rolePermissionRepository.findOne({
      where: {
        roleId: createDto.roleId,
        permissionId: createDto.permissionId,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new BadRequestException(ROLE_PERMISSION_ERRORS.ALREADY_EXISTS);
    }

    return await this.rolePermissionRepository.create(createDto, entityManager);
  }

  async bulkCreate(
    bulkDto: BulkCreateRolePermissionsDto,
    entityManager?: EntityManager,
  ): Promise<RolePermissionEntity[]> {
    const results: RolePermissionEntity[] = [];

    for (const permissionId of bulkDto.permissionIds) {
      try {
        const result = await this.create(
          {
            roleId: bulkDto.roleId,
            permissionId,
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

  private async validateRoleExists(roleId: string): Promise<void> {
    await this.rolesService.findOneOrFail({ where: { id: roleId, deletedAt: null } });
  }

  private async validatePermissionExists(permissionId: string): Promise<void> {
    await this.permissionsService.findOneOrFail({ where: { id: permissionId, deletedAt: null } });
  }
}
