import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionRepository } from './permission.repository';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere, ILike } from 'typeorm';
import { PermissionEntity } from './entities/permission.entity';
import { CreatePermissionDto, DeletePermissionDto, GetPermissionDto } from './dto';
import { PERMISSION_ERRORS, PERMISSION_FIELD_NAMES } from './constants/permission.constants';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { DataSuccessOperationType, SortOrder } from 'src/utils/utility/constants/utility.constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionRepository: PermissionRepository,
    private readonly configSettingService: ConfigSettingService,
    private readonly configurationService: ConfigurationService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createDto: CreatePermissionDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    await this.validateModuleExists(createDto.module);

    // Check for active permission with same name
    const existingPermission = await this.permissionRepository.findOne({
      where: { name: createDto.name, deletedAt: null },
    });

    if (existingPermission) {
      throw new BadRequestException(PERMISSION_ERRORS.ALREADY_EXISTS(createDto.name));
    }

    // Handle legacy soft-deleted records - rename them to allow new record creation
    const softDeletedPermission = await this.permissionRepository.findOne({
      where: { name: createDto.name },
    });

    if (softDeletedPermission && softDeletedPermission.deletedAt) {
      await this.permissionRepository.update(
        { id: softDeletedPermission.id },
        {
          name: `${
            softDeletedPermission.name
          }__deleted_${softDeletedPermission.deletedAt.getTime()}`,
        },
        entityManager,
      );
    }

    await this.permissionRepository.create(createDto, entityManager);

    return this.utilityService.getSuccessMessage(
      PERMISSION_FIELD_NAMES.PERMISSION,
      DataSuccessOperationType.CREATE,
    );
  }

  private async validateModuleExists(module: string): Promise<void> {
    try {
      const modulesSetting = await this.configurationService.findOneOrFail({
        where: { module: CONFIGURATION_MODULES.PERMISSION, key: CONFIGURATION_KEYS.MODULES },
      });

      const configSetting = await this.configSettingService.findOneOrFail({
        where: { configId: modulesSetting.id, isActive: true },
      });

      if (!configSetting.value.includes(module)) {
        throw new BadRequestException(
          PERMISSION_ERRORS.INVALID_MODULE_NOT_IN_CONFIG(module, configSetting.value),
        );
      }
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: GetPermissionDto): Promise<{
    records: PermissionEntity[];
    totalRecords: number;
  }> {
    const { module, search, page, pageSize, sortField, sortOrder } = options;

    // Build where conditions
    const where: FindOptionsWhere<PermissionEntity> = { deletedAt: null };

    // Filter by module name
    if (module) {
      where.module = module;
    }

    // Search by label (case-insensitive)
    if (search) {
      where.label = ILike(`%${search}%`);
    }

    // Build find options with pagination and sorting
    const findOptions: FindManyOptions<PermissionEntity> = {
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { [sortField]: sortOrder === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC },
    };

    return await this.permissionRepository.findAll(findOptions);
  }

  async findOneOrFail(options: FindOneOptions<PermissionEntity>): Promise<PermissionEntity> {
    try {
      const permission = await this.permissionRepository.findOne(options);
      if (!permission) {
        throw new NotFoundException(PERMISSION_ERRORS.NOT_FOUND);
      }
      return permission;
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<PermissionEntity>,
    updateData: Partial<PermissionEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const permission = await this.findOneOrFail({ where: { id: identifierConditions.id } });
      if (!permission.isEditable) {
        throw new BadRequestException(PERMISSION_ERRORS.NOT_EDITABLE);
      }
      await this.permissionRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        PERMISSION_FIELD_NAMES.PERMISSION,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }

  async delete(identifierConditions: FindOptionsWhere<PermissionEntity>, deletedBy: string) {
    try {
      const permission = await this.findOneOrFail({ where: identifierConditions });
      if (!permission.isDeletable) {
        throw new BadRequestException(PERMISSION_ERRORS.NOT_DELETABLE);
      }
      const deletedAt = new Date();
      await this.permissionRepository.update(identifierConditions, {
        name: `${permission.name}__deleted_${deletedAt.getTime()}`,
        deletedAt,
        deletedBy,
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteBulk({ ids }: DeletePermissionDto, deletedBy: string) {
    try {
      const results = { success: [], failed: [] };
      for (const id of ids) {
        try {
          await this.delete({ id }, deletedBy);
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

  async count(): Promise<number> {
    return await this.permissionRepository.count();
  }
}
