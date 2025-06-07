import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigurationRepository } from './configuration.repository';
import { EntityManager, FindManyOptions, FindOneOptions } from 'typeorm';
import { ConfigurationEntity } from './entities/configuration.entity';
import { CreateConfigurationDto, GetConfigurationDto } from './dto/configuration.dto';
import { CONFIGURATION_ERRORS } from './constants/configuration.constant';

@Injectable()
export class ConfigurationService {
  constructor(private configurationRepository: ConfigurationRepository) {}

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

  async findOneOrFail(options: FindOneOptions<ConfigurationEntity>): Promise<ConfigurationEntity> {
    try {
      const configuration = await this.configurationRepository.findOne(options);

      if (!configuration) {
        throw new NotFoundException(CONFIGURATION_ERRORS.NOT_FOUND);
      }

      return configuration;
    } catch (error) {
      throw error;
    }
  }
}
