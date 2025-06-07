import { Injectable } from '@nestjs/common';
import { UserPermissionRepository } from './user-permission.repository';
import { EntityManager } from 'typeorm';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { CreateUserPermissionDto } from './dto/user-permission.dto';
import { PermissionSource } from './constants/user-permission.constants';
import { UserPermissionResult } from './user-permission.types';
import { UserService } from '../users/user.service';
import { PermissionService } from '../permissions/permission.service';
import { getUserPermissionsQuery } from './queries/user-permission.queries';

@Injectable()
export class UserPermissionService {
  constructor(
    private readonly userPermissionRepository: UserPermissionRepository,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  async create(
    createDto: CreateUserPermissionDto,
    entityManager?: EntityManager,
  ): Promise<UserPermissionEntity> {
    await this.validateUserExists(createDto.userId);
    await this.validatePermissionExists(createDto.permissionId);

    const existing = await this.userPermissionRepository.findOne({
      where: {
        userId: createDto.userId,
        permissionId: createDto.permissionId,
        deletedAt: null,
      },
    });

    if (existing) {
      await this.userPermissionRepository.update(
        { id: existing.id },
        { isGranted: createDto.isGranted },
        entityManager,
      );
      return existing;
    }

    return await this.userPermissionRepository.create(createDto, entityManager);
  }

  private async validateUserExists(userId: string): Promise<void> {
    await this.userService.findOneOrFail({ where: { id: userId, deletedAt: null } });
  }

  private async validatePermissionExists(permissionId: string): Promise<void> {
    await this.permissionService.findOneOrFail({ where: { id: permissionId, deletedAt: null } });
  }

  async getUserPermissions(userId: string): Promise<UserPermissionResult> {
    try {
      const rolePermissions = await this.userPermissionRepository.executeRawQuery(
        getUserPermissionsQuery(),
        [userId],
      );

      // Get user-specific permission overrides
      const userOverrides = await this.userPermissionRepository.findAll({
        where: { userId },
        relations: ['permission'],
      });

      const permissionMap = new Map();

      // Add permissions from roles
      rolePermissions.forEach((rp) => {
        permissionMap.set(rp.permissionId, {
          id: rp.permissionId,
          name: rp.permissionName,
          module: rp.permissionModule,
          source: PermissionSource.ROLE,
          isGranted: true,
        });
      });

      // Apply user-specific overrides (these take precedence)
      userOverrides.forEach((override) => {
        permissionMap.set(override.permission.id, {
          id: override.permission.id,
          name: override.permission.name,
          module: override.permission.module,
          source: PermissionSource.OVERRIDE,
          isGranted: override.isGranted,
        });
      });

      const allPermissions = Array.from(permissionMap.values()).filter(
        (permission) => permission.isGranted,
      );

      // Group permissions by module
      const groupedByModule = allPermissions.reduce(
        (acc, permission) => {
          const module = permission.module;

          if (!acc[module]) {
            acc[module] = [];
          }

          acc[module].push({
            id: permission.id,
            name: permission.name,
            label: permission.label,
            source: permission.source,
            isGranted: permission.isGranted,
          });

          return acc;
        },
        {} as Record<
          string,
          Array<{
            id: string;
            name: string;
            label?: string;
            source: PermissionSource;
            isGranted: boolean;
          }>
        >,
      );

      // Convert to array format
      const permissionsArray = Object.keys(groupedByModule).map((module) => ({
        module,
        permissions: groupedByModule[module],
      }));

      return {
        userId,
        permissions: permissionsArray,
      };
    } catch (error) {
      throw error;
    }
  }
}
