import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionRepository } from './permission.repository';
import { EntityManager, FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';
import { PermissionEntity } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/permission.dto';
import { PERMISSION_ERRORS, PERMISSION_FIELD_NAMES } from './constants/permission.constants';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { ConfigurationService } from '../configurations/configuration.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
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
    createDto: CreatePermissionDto,
    entityManager?: EntityManager,
  ): Promise<PermissionEntity> {
    await this.validateModuleExists(createDto.module);
    const existingPermission = await this.permissionRepository.findOne({
      where: { name: createDto.name, deletedAt: null },
    });

    if (existingPermission) {
      throw new BadRequestException(PERMISSION_ERRORS.ALREADY_EXISTS(createDto.name));
    }

    return await this.permissionRepository.create(createDto, entityManager);
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

  async findAll(options: FindManyOptions<PermissionEntity>): Promise<{
    records: PermissionEntity[];
    totalRecords: number;
  }> {
    return await this.permissionRepository.findAll(options);
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
      await this.findOneOrFail({ where: { id: identifierConditions.id } });
      await this.permissionRepository.update(identifierConditions, updateData, entityManager);
      return this.utilityService.getSuccessMessage(
        PERMISSION_FIELD_NAMES.PERMISSION,
        DataSuccessOperationType.UPDATE,
      );
    } catch (error) {
      throw error;
    }
  }
}
