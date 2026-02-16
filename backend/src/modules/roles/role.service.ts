import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { RoleEntity } from './entities/role.entity';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { ROLE_ERRORS, ROLE_FIELD_NAMES } from './constants/role.constants';
import { CreateRoleDto, DeleteRoleDto, GetAllRoleDto } from './dto';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { PermissionService } from '../permissions/permission.service';

@Injectable()
export class RoleService {
  constructor(
    private roleRepository: RoleRepository,
    private utilityService: UtilityService,
    private permissionService: PermissionService,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<RoleEntity> {
    try {
      const existingRole = await this.roleRepository.findOne({
        where: { name: createRoleDto.name },
      });
      if (existingRole) throw new ConflictException(ROLE_ERRORS.ALREADY_EXISTS);
      return await this.roleRepository.create(createRoleDto);
    } catch (error) {
      throw error;
    }
  }

  async findOne(whereCondition: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      return this.roleRepository.findOne(whereCondition);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(whereCondition: FindOneOptions<RoleEntity>): Promise<RoleEntity> {
    try {
      const role = await this.roleRepository.findOne(whereCondition);
      if (!role) {
        throw new NotFoundException(ROLE_ERRORS.NOT_FOUND);
      }
      return role;
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: GetAllRoleDto): Promise<{
    records: (RoleEntity & { permissionCount: number })[];
    totalRecords: number;
    totalPermissions: number;
  }> {
    try {
      const { name, search, page, pageSize, sortField, sortOrder } = options;

      // Build where conditions (pass raw values for query builder)
      const where: FindOptionsWhere<RoleEntity> & { search?: string } = { deletedAt: null };

      // Filter by name
      if (name) {
        where.name = name;
      }

      // Search by label (pass raw value, repository will handle ILike)
      if (search) {
        where.search = search;
      }

      // Build find options with pagination and sorting
      const findOptions: FindManyOptions<RoleEntity> = {
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        order: { [sortField]: sortOrder === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC },
      };

      const rolesResult = await this.roleRepository.findAll(findOptions);
      const totalPermissionsResult = await this.permissionService.findAll({});

      return {
        ...rolesResult,
        totalPermissions: totalPermissionsResult.totalRecords,
      };
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<RoleEntity>,
    updateData: Partial<RoleEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const role = await this.findOneOrFail({
        where: identifierConditions,
      });
      if (!role.isEditable) {
        throw new BadRequestException(ROLE_ERRORS.NOT_EDITABLE);
      }
      await this.roleRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        ROLE_FIELD_NAMES.ROLE,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(identifierConditions: FindOptionsWhere<RoleEntity>) {
    try {
      const role = await this.findOneOrFail({ where: identifierConditions });
      if (!role.isDeletable) {
        throw new BadRequestException(ROLE_ERRORS.NOT_DELETABLE);
      }
      await this.roleRepository.update(identifierConditions, { deletedAt: new Date() });
    } catch (error) {
      throw error;
    }
  }

  async deleteBulk({ ids }: DeleteRoleDto) {
    try {
      const results = { success: [], failed: [] };
      for (const id of ids) {
        try {
          await this.delete({ id });
          results.success.push(id);
        } catch (error) {
          results.failed.push({ id, error: error.message });
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  }
}
