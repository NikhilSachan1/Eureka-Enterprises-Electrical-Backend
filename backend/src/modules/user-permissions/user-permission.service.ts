import { ConflictException, Injectable } from '@nestjs/common';
import { UserPermissionRepository } from './user-permission.repository';
import { EntityManager } from 'typeorm';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { BulkCreateUserPermissionsDto, CreateUserPermissionDto } from './dto/user-permission.dto';
import { PermissionSource } from './constants/user-permission.constants';
import { UserPermissionResult } from './user-permission.types';
import { UserService } from '../users/user.service';
import { PermissionService } from '../permissions/permission.service';
import {
  findAllUsersWithPermissionStats,
  getUserPermissionsQuery,
} from './queries/user-permission.queries';
import {
  DeleteUserPermissionDto,
  BulkDeleteUserPermissionsDto,
  GetUserPermissionStatsDto,
} from './dto';
import {
  USER_PERMISSION_ERRORS,
  USER_PERMISSION_SUCCESS_MESSAGES,
} from './constants/user-permission.constants';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class UserPermissionService {
  constructor(
    private readonly userPermissionRepository: UserPermissionRepository,
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  async create(
    { permissionId, isGranted, userId }: CreateUserPermissionDto & { userId: string },
    entityManager?: EntityManager,
  ): Promise<UserPermissionEntity> {
    await this.validatePermissionExists(permissionId);

    const whereClause = { userId, permissionId, deletedAt: null };
    const existing = await this.userPermissionRepository.findOne({ where: whereClause });

    if (existing) {
      if (existing.isGranted === isGranted) {
        throw new ConflictException(USER_PERMISSION_ERRORS.ALREADY_EXISTS);
      }

      await this.userPermissionRepository.update(whereClause, {
        isGranted,
        updatedAt: new Date(),
      });

      return this.userPermissionRepository.findOne({ where: whereClause });
    }

    return this.userPermissionRepository.create({ userId, permissionId, isGranted }, entityManager);
  }

  async bulkCreate(
    { userId, userPermissions }: BulkCreateUserPermissionsDto,
    entityManager?: EntityManager,
  ): Promise<UserPermissionEntity[]> {
    const results: UserPermissionEntity[] = [];
    await this.validateUserExists(userId);

    for (const { permissionId, isGranted } of userPermissions) {
      try {
        const result = await this.create(
          {
            userId,
            permissionId,
            isGranted,
          },
          entityManager,
        );
        results.push(result);
      } catch (error) {
        throw error;
      }
    }

    return results;
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

  async delete(
    { userId, permissionId }: DeleteUserPermissionDto,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<{ message: string }> {
    await this.validateUserExists(userId);
    await this.validatePermissionExists(permissionId);

    const existing = await this.userPermissionRepository.findOne({
      where: {
        userId,
        permissionId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException(USER_PERMISSION_ERRORS.NOT_FOUND);
    }
    await this.userPermissionRepository.delete(existing.id, deletedBy, entityManager);

    return { message: USER_PERMISSION_SUCCESS_MESSAGES.DELETED };
  }

  async bulkDelete(
    { userId, permissionIds }: BulkDeleteUserPermissionsDto,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<{ message: string }> {
    await this.validateUserExists(userId);

    for (const permissionId of permissionIds) {
      await this.validatePermissionExists(permissionId);
    }

    for (const permissionId of permissionIds) {
      await this.delete({ userId, permissionId }, deletedBy, entityManager);
    }

    return {
      message: USER_PERMISSION_SUCCESS_MESSAGES.DELETED,
    };
  }

  async findAllUsersWithPermissionStats(options: GetUserPermissionStatsDto): Promise<{
    records: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
      rolePermissionsCount: number;
      userPermissionsCount: number;
      totalPermissions: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
    totalRecords: number;
    systemTotalPermissions: number;
  }> {
    try {
      const { pageSize, page } = options;
      const offset = (page - 1) * pageSize;
      const { usersQuery, countQuery } = findAllUsersWithPermissionStats(options);
      const params = [pageSize, offset];
      const [users, countResult] = await Promise.all([
        this.userPermissionRepository.executeRawQuery(usersQuery, params),
        this.userPermissionRepository.executeRawQuery(countQuery),
      ]);

      const transformedUsers = users.map((user: any) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
        rolePermissionsCount: parseInt(user.role_permissions_count) || 0,
        userPermissionsCount: parseInt(user.user_permissions_count) || 0,
        totalPermissions: parseInt(user.total_permissions) || 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return {
        records: transformedUsers,
        totalRecords: parseInt(countResult[0].total_users),
        systemTotalPermissions: users.length > 0 ? parseInt(users[0].system_total_permissions) : 0,
      };
    } catch (error) {
      throw error;
    }
  }
}
