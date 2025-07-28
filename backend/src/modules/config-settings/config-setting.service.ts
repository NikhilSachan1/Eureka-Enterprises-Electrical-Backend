import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigSettingRepository } from './config-setting.repository';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
import { ConfigSettingEntity } from './entities/config-setting.entity';
import { CreateConfigSettingDto, GetConfigSettingDto, UpdateConfigSettingDto } from './dto';
import { ConfigurationService } from '../configurations/configuration.service';
import { ValueTypeValidator } from './utils/value-type-validator';
import { CONFIG_SETTING_ERRORS } from './constants/config-setting.constants';
import { CONFIGURATION_MODULES } from 'src/utils/master-constants/master-constants';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class ConfigSettingService {
  constructor(
    private readonly configSettingRepository: ConfigSettingRepository,
    private readonly configurationService: ConfigurationService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(
    createDto: CreateConfigSettingDto,
    entityManager?: EntityManager,
  ): Promise<ConfigSettingEntity> {
    const configuration = await this.validateAndGetConfiguration(createDto.configId);
    ValueTypeValidator.validate(createDto.value, configuration.valueType, configuration.key);
    return await this.performUpsert(createDto, entityManager);
  }

  async update(
    id: string,
    updateDto: UpdateConfigSettingDto,
    entityManager?: EntityManager,
  ): Promise<ConfigSettingEntity> {
    const configSetting = await this.findOneOrFail({ where: { id } });

    if (updateDto.value !== undefined) {
      ValueTypeValidator.validate(
        updateDto.value,
        configSetting.configuration.valueType,
        configSetting.configuration.key,
      );
    }

    const updateData: Partial<ConfigSettingEntity> = {
      ...updateDto,
      ...(updateDto.effectiveFrom && { effectiveFrom: new Date(updateDto.effectiveFrom) }),
      ...(updateDto.effectiveTo && { effectiveTo: new Date(updateDto.effectiveTo) }),
    };

    return await this.performUpsert({ ...configSetting, ...updateData }, entityManager, id);
  }

  async findAll(options: FindManyOptions<ConfigSettingEntity> & GetConfigSettingDto): Promise<{
    records: ConfigSettingEntity[];
    totalRecords: number;
  }> {
    return await this.configSettingRepository.findAll(options);
  }

  async findOne(options: FindOneOptions<ConfigSettingEntity>): Promise<ConfigSettingEntity | null> {
    return await this.configSettingRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<ConfigSettingEntity>): Promise<ConfigSettingEntity> {
    const configSetting = await this.configSettingRepository.findOne(options);
    if (!configSetting) {
      throw new NotFoundException(CONFIG_SETTING_ERRORS.NOT_FOUND);
    }
    return configSetting;
  }

  private async validateAndGetConfiguration(configId: string) {
    try {
      return await this.configurationService.findOneOrFail({
        where: { id: configId },
      });
    } catch (error) {
      throw error;
    }
  }

  private async validateLeaveConfig(createDto: CreateConfigSettingDto) {
    if (!createDto.effectiveFrom || !createDto.effectiveTo) {
      throw new BadRequestException(CONFIG_SETTING_ERRORS.EFFECTIVE_FROM_AND_TO_REQUIRED);
    }
    if (new Date(createDto.effectiveFrom) > new Date(createDto.effectiveTo)) {
      throw new BadRequestException(CONFIG_SETTING_ERRORS.EFFECTIVE_FROM_CANNOT_BE_GREATER_THAN_TO);
    }
    if (
      new Date(createDto.effectiveFrom) < new Date() ||
      new Date(createDto.effectiveTo) < new Date()
    ) {
      throw new BadRequestException(CONFIG_SETTING_ERRORS.EFFECTIVE_FROM_TO_CANNOT_BE_IN_PAST);
    }
    if (createDto.contextKey === this.utilityService.getCurrentFinancialYear()) {
      throw new BadRequestException(
        CONFIG_SETTING_ERRORS.LEAVE_CONFIG_CANNOT_BE_CREATED_UPDATED_FOR_CURRENT_FINANCIAL_YEAR,
      );
    }
  }

  private async performUpsert(
    data: any,
    entityManager?: EntityManager,
    existingId?: string,
  ): Promise<ConfigSettingEntity> {
    const queryRunner = entityManager || this.configSettingRepository['repository'].manager;
    const configuration = await this.validateAndGetConfiguration(data.configId);
    const isCurrentFinancialYear =
      data.contextKey === this.utilityService.getCurrentFinancialYear();
    switch (configuration.module) {
      case CONFIGURATION_MODULES.LEAVE:
        await this.validateLeaveConfig(data);

        break;
    }
    // TODO: Actual value check for config setting with AJV.
    return await queryRunner.transaction(async (transactionManager) => {
      // Deactivate all existing active records for this configId
      //NOTE: current financial year is not allowed to be updated
      if (isCurrentFinancialYear) {
        await transactionManager
          .createQueryBuilder()
          .update(ConfigSettingEntity)
          .set({ isActive: false })
          .where('configId = :configId', { configId: data.configId })
          .andWhere('deletedAt IS NULL')
          .execute();
      }

      // Create or update the record as active
      if (existingId) {
        await this.configSettingRepository.update(
          { id: existingId },
          { ...data, isActive: isCurrentFinancialYear },
          transactionManager,
        );
        return await this.findOneOrFail({ where: { id: existingId } });
      } else {
        return await this.configSettingRepository.create(
          { ...data, isActive: isCurrentFinancialYear },
          transactionManager,
        );
      }
    });
  }
}
