import { ConflictException, forwardRef, Inject, Injectable } from '@nestjs/common';
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
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  async create(
    { permissionId, isGranted, userId }: CreateUserPermissionDto & { userId: string },
    entityManager?: EntityManager,
  ): Promise<UserPermissionEntity> {
    await this.validatePermissionExists(permissionId);

    const whereClause = { userId, permissionId };

    // Check for active record
    const existing = await this.userPermissionRepository.findOne({
      where: { ...whereClause, deletedAt: null },
    });

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

    // Check for soft-deleted record and hard delete it before creating new
    const softDeleted = await this.userPermissionRepository.findOneWithDeleted({
      where: whereClause,
    });

    if (softDeleted && softDeleted.deletedAt) {
      // Hard delete the soft-deleted record to allow new record creation
      await this.userPermissionRepository.hardDelete({ id: softDeleted.id }, entityManager);
    }

    return this.userPermissionRepository.create({ userId, permissionId, isGranted }, entityManager);
  }

  async bulkCreate(
    { userId, userPermissions }: BulkCreateUserPermissionsDto,
    entityManager?: EntityManager,
  ) {
    const results: { id: string; success: boolean; message: string }[] = [];
    await this.validateUserExists(userId);

    for (const { permissionId, isGranted } of userPermissions) {
      try {
        await this.create({ userId, permissionId, isGranted }, entityManager);
        results.push({
          id: permissionId,
          success: true,
          message: 'User permission created successfully',
        });
      } catch (error) {
        results.push({
          id: permissionId,
          success: false,
          message: error.message || 'Failed to create user permission',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      message: `Bulk create completed: ${successCount} succeeded, ${failureCount} failed`,
      totalRequested: userPermissions.length,
      successCount,
      failureCount,
      results,
    };
  }

  private async validateUserExists(userId: string): Promise<void> {
    await this.userService.findOneOrFail({ where: { id: userId, deletedAt: null } });
  }

  private async validatePermissionExists(permissionId: string): Promise<void> {
    await this.permissionService.findOneOrFail({ where: { id: permissionId, deletedAt: null } });
  }

  async getUserPermissions(
    userId: string,
    roleId?: string,
    isActive?: boolean,
  ): Promise<UserPermissionResult> {
    try {
      const rolePermissions = await this.userPermissionRepository.executeRawQuery(
        getUserPermissionsQuery({ userId, roleId, isActive }),
      );

      // Get user-specific permission overrides
      const userOverrides = await this.userPermissionRepository.findAll({
        where: { userId },
        relations: ['permission'],
      });

      const permissionMap = new Map();

      // Extract role info from first permission (if filtering by role)
      let roleInfo: { id: string; name: string; label: string } | undefined;
      if (roleId && rolePermissions.length > 0) {
        const firstPermission = rolePermissions[0];
        roleInfo = {
          id: firstPermission.roleId,
          name: firstPermission.roleName,
          label: firstPermission.roleLabel,
        };
      }

      // Add permissions from roles
      rolePermissions.forEach((rp) => {
        permissionMap.set(rp.permissionId, {
          id: rp.permissionId,
          name: rp.permissionName,
          module: rp.permissionModule,
          source: PermissionSource.ROLE,
          isGranted: rp.isGranted,
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
        (permission) => permission.isGranted === true || permission.isGranted === false,
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
        ...(roleInfo && { role: roleInfo }),
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
      employeeId: string;
      firstName: string;
      lastName: string;
      email: string;
      status: string;
      role: string;
      rolePermissionsCount: number;
      userPermissionsGrantedCount: number;
      userPermissionsRevokedCount: number;
      effectivePermissionsCount: number;
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
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        status: user.status,
        role: user.role_names,
        rolePermissionsCount: parseInt(user.role_permissions_count) || 0,
        userPermissionsGrantedCount: parseInt(user.user_permissions_granted_count) || 0,
        userPermissionsRevokedCount: parseInt(user.user_permissions_revoked_count) || 0,
        effectivePermissionsCount: parseInt(user.effective_permissions_count) || 0,
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

  async deleteAllForUser(
    userId: string,
    deletedBy: string,
    entityManager?: EntityManager,
  ): Promise<{ deletedCount: number }> {
    try {
      const result = await this.userPermissionRepository.softDeleteByUserId(
        userId,
        deletedBy,
        entityManager,
      );
      return { deletedCount: result.affected || 0 };
    } catch (error) {
      throw error;
    }
  }

  async bulkDeleteByUsers(
    userIds: string[],
    deletedBy: string,
  ): Promise<{
    message: string;
    totalDeleted: number;
    deletedCounts: Record<string, number>;
  }> {
    try {
      const deletedCounts: Record<string, number> = {};
      let totalDeleted = 0;

      for (const userId of userIds) {
        const result = await this.deleteAllForUser(userId, deletedBy);
        deletedCounts[userId] = result.deletedCount;
        totalDeleted += result.deletedCount;
      }

      return {
        message: USER_PERMISSION_SUCCESS_MESSAGES.BULK_DELETE_SUCCESS,
        totalDeleted,
        deletedCounts,
      };
    } catch (error) {
      throw error;
    }
  }
}
