import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigSettingRepository } from './config-setting.repository';
import { EntityManager } from 'typeorm';
import { ConfigSettingEntity } from './entities/config-setting.entity';
import { CreateConfigSettingDto, GetConfigSettingDto, UpdateConfigSettingDto } from './dto';
import { ConfigurationService } from '../configurations/configuration.service';
import { ValueTypeValidator } from './utils/value-type-validator';
import { CONFIG_SETTING_ERRORS } from './constants/config-setting.constants';

@Injectable()
export class ConfigSettingService {
  constructor(
    private readonly configSettingRepository: ConfigSettingRepository,
    private readonly configurationService: ConfigurationService,
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
    const configSetting = await this.findOneOrFail(id);

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

  async findAll(options: GetConfigSettingDto): Promise<{
    records: ConfigSettingEntity[];
    totalRecords: number;
  }> {
    return await this.configSettingRepository.findAll(options);
  }

  async findOne(id: string): Promise<ConfigSettingEntity | null> {
    return await this.configSettingRepository.findOne({
      where: { id },
      relations: ['configuration'],
    });
  }

  async findOneOrFail(id: string): Promise<ConfigSettingEntity> {
    const configSetting = await this.findOne(id);

    if (!configSetting) {
      throw new NotFoundException(CONFIG_SETTING_ERRORS.NOT_FOUND);
    }

    return configSetting;
  }

  private async validateAndGetConfiguration(configId: string) {
    try {
      return await this.configurationService.findOneOrFail({ where: { id: configId } });
    } catch (error) {
      throw error;
    }
  }

  private async performUpsert(
    data: any,
    entityManager?: EntityManager,
    existingId?: string,
  ): Promise<ConfigSettingEntity> {
    const queryRunner = entityManager || this.configSettingRepository['repository'].manager;

    return await queryRunner.transaction(async (transactionManager) => {
      // Deactivate all existing active records for this configId
      await transactionManager
        .createQueryBuilder()
        .update(ConfigSettingEntity)
        .set({ isActive: false })
        .where('configId = :configId', { configId: data.configId })
        .andWhere('deletedAt IS NULL')
        .execute();

      // Create or update the record as active
      if (existingId) {
        await this.configSettingRepository.update(
          { id: existingId },
          { ...data, isActive: true },
          transactionManager,
        );
        return await this.findOneOrFail(existingId);
      } else {
        return await this.configSettingRepository.create(
          { ...data, isActive: true },
          transactionManager,
        );
      }
    });
  }
}
