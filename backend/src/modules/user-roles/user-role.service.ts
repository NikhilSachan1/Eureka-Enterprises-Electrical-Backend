import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRoleRepository } from './user-role.repository';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  DataSource,
} from 'typeorm';
import { UserRoleEntity } from './entities/user-role.entity';
import { UpdateUserRoleDto, AssignUserRolesDto } from './dto';
import { UtilityService } from '../../utils/utility/utility.service';
import { USER_ROLE_FIELD_NAMES, USER_ROLE_ERRORS } from './constants/user-role.constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { UserPermissionService } from '../user-permissions/user-permission.service';
import { RoleService } from '../roles/role.service';

@Injectable()
export class UserRoleService {
  constructor(
    private userRoleRepository: UserRoleRepository,
    private readonly utilityService: UtilityService,
    @Inject(forwardRef(() => UserPermissionService))
    private readonly userPermissionService: UserPermissionService,
    @Inject(forwardRef(() => RoleService))
    private readonly roleService: RoleService,
    private readonly dataSource: DataSource,
  ) {}

  async create(userRole: Partial<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      return await this.userRoleRepository.create(userRole, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOneOptions<UserRoleEntity>, entityManager?: EntityManager) {
    try {
      return await this.userRoleRepository.findOne(options, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<UserRoleEntity>,
    updateData: Partial<UserRoleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      return await this.userRoleRepository.update(identifierConditions, updateData, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async updateUserRole(id: string, updateUserRoleDto: UpdateUserRoleDto, deletedBy?: string) {
    await this.update({ id }, updateUserRoleDto);

    // Delete user permission overrides as they may no longer be relevant with the new role
    await this.userPermissionService.deleteAllForUser(
      updateUserRoleDto.userId,
      deletedBy || updateUserRoleDto.userId,
    );

    return {
      message: this.utilityService.getSuccessMessage(
        USER_ROLE_FIELD_NAMES.USER_ROLE,
        DataSuccessOperationType.UPDATE,
      ),
    };
  }

  async findAll(options: FindManyOptions<UserRoleEntity>): Promise<UserRoleEntity[]> {
    try {
      return await this.userRoleRepository.findAll(options);
    } catch (error) {
      throw error;
    }
  }

  async assignRolesToUser(userId: string, assignDto: AssignUserRolesDto, assignedBy: string) {
    const { roleIds } = assignDto;

    // Validate all roles exist
    for (const roleId of roleIds) {
      const role = await this.roleService.findOne({ where: { id: roleId, deletedAt: null } });
      if (!role) {
        throw new NotFoundException(USER_ROLE_ERRORS.ROLE_NOT_FOUND(roleId));
      }
    }

    // Use transaction to ensure atomicity
    return await this.dataSource.transaction(async (entityManager) => {
      // Soft delete all existing roles for the user
      await this.userRoleRepository.softDeleteByUserId(userId, assignedBy, entityManager);

      // Create new role assignments
      const userRoles: Partial<UserRoleEntity>[] = roleIds.map((roleId) => ({
        userId,
        roleId,
        createdBy: assignedBy,
      }));

      await this.userRoleRepository.createBulk(userRoles, entityManager);

      // Delete user permission overrides as they may no longer be relevant with the new roles
      await this.userPermissionService.deleteAllForUser(userId, assignedBy, entityManager);

      return this.utilityService.getSuccessMessage(
        USER_ROLE_FIELD_NAMES.USER_ROLE,
        DataSuccessOperationType.UPDATE,
      );
    });
  }
}
