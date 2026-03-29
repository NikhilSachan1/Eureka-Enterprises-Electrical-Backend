import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigurationRepository } from './configuration.repository';
import { EntityManager, FindManyOptions, FindOneOptions, DataSource, IsNull } from 'typeorm';
import { ConfigurationEntity } from './entities/configuration.entity';
import {
  CreateConfigurationDto,
  GetConfigurationDto,
  CreateConfigurationWithSettingsDto,
  UpdateConfigurationDto,
} from './dto/configuration.dto';
import { CONFIGURATION_ERRORS } from './constants/configuration.constant';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class ConfigurationService {
  constructor(
    private configurationRepository: ConfigurationRepository,
    @Inject(forwardRef(() => ConfigSettingService))
    private configSettingService: ConfigSettingService,
    private dataSource: DataSource,
    private utilityService: UtilityService,
  ) {}

  async create(
    configuration: CreateConfigurationDto,
    entityManager?: EntityManager,
  ): Promise<ConfigurationEntity> {
    try {
      const existingConfig = await this.configurationRepository.findOne({
        where: { key: configuration.key },
      });

      if (existingConfig) {
        throw new BadRequestException(
          CONFIGURATION_ERRORS.CONFIGURATION_KEY_ALREADY_EXISTS.replace(
            '{{key}}',
            configuration.key,
          ),
        );
      }
      return await this.configurationRepository.create(configuration, entityManager);
    } catch (error) {
      throw error;
    }
  }

  async findAll(options: FindManyOptions<ConfigurationEntity> & GetConfigurationDto): Promise<{
    records: ConfigurationEntity[];
    totalRecords: number;
  }> {
    try {
      return await this.configurationRepository.findAll(options);
    } catch (error) {
      throw error;
    }
  }

  async findOne(options: FindOneOptions<ConfigurationEntity>): Promise<ConfigurationEntity> {
    try {
      return await this.configurationRepository.findOne(options);
    } catch (error) {
      throw error;
    }
  }

  async findOneById(id: string): Promise<ConfigurationEntity> {
    try {
      const configuration = await this.configurationRepository.findOne({
        where: { id },
        relations: ['configSettings'],
      });
      if (!configuration) {
        throw new NotFoundException(CONFIGURATION_ERRORS.NOT_FOUND);
      }
      return configuration;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create configuration with optional config settings in a transaction
   */
  async createWithSettings(dto: CreateConfigurationWithSettingsDto): Promise<ConfigurationEntity> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      try {
        // Create configuration first
        const configurationData: CreateConfigurationDto = {
          module: dto.module,
          key: dto.key,
          label: dto.label,
          valueType: dto.valueType,
          isEditable: dto.isEditable,
          description: dto.description,
        };

        // Check if configuration key already exists
        const existingConfig = await this.configurationRepository.findOne({
          where: { key: dto.key, deletedAt: IsNull() },
        });

        if (existingConfig) {
          throw new BadRequestException(
            CONFIGURATION_ERRORS.CONFIGURATION_KEY_ALREADY_EXISTS.replace('{{key}}', dto.key),
          );
        }

        const createdConfiguration = await this.configurationRepository.create(
          configurationData,
          manager,
        );

        // Create config settings if provided
        if (dto.configSettings && dto.configSettings.length > 0) {
          for (const settingData of dto.configSettings) {
            const configSettingDto = {
              configId: createdConfiguration.id,
              contextKey: settingData.contextKey,
              value: settingData.value,
              effectiveFrom: settingData.effectiveFrom,
              effectiveTo: settingData.effectiveTo,
              isActive: settingData.isActive ?? true,
              isSystemOperation: true, // Skip validation for this creation flow
            };

            await this.configSettingService.create(configSettingDto, manager);
          }
        }

        // Return the complete configuration with settings
        return await this.findOneById(createdConfiguration.id);
      } catch (error) {
        throw error;
      }
    });
  }

  /** Update a configuration by id. Key must stay unique if changed. */
  async update(id: string, dto: UpdateConfigurationDto): Promise<ConfigurationEntity> {
    const existing = await this.findOneOrFail({ where: { id } });

    // If key is being changed, check uniqueness
    if (dto.key !== undefined && dto.key !== existing.key) {
      const duplicate = await this.configurationRepository.findOne({
        where: { key: dto.key },
      });
      if (duplicate) {
        throw new BadRequestException(
          CONFIGURATION_ERRORS.CONFIGURATION_KEY_ALREADY_EXISTS.replace('{{key}}', dto.key),
        );
      }
    }

    await this.configurationRepository.update({ id }, dto);
    return await this.findOneById(id);
  }

  async findAllWithActiveConfigSettings(options: GetConfigurationDto): Promise<{
    records: ConfigurationEntity[];
    totalRecords: number;
  }> {
    try {
      return await this.configurationRepository.findAllWithActiveConfigSettings(options);
    } catch (error) {
      throw error;
    }
  }

  async findOneOrFail(
    options: FindOneOptions<ConfigurationEntity>,
    entityManager?: EntityManager,
  ): Promise<ConfigurationEntity> {
    try {
      const configuration = await this.configurationRepository.findOne(options, entityManager);

      if (!configuration) {
        throw new NotFoundException(CONFIGURATION_ERRORS.NOT_FOUND);
      }

      return configuration;
    } catch (error) {
      throw error;
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      await this.configurationRepository.update({ id }, { deletedAt: new Date() });
      await this.configSettingService.delete(id);
      return { message: 'Configuration deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}
