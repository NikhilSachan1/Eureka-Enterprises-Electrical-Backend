import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigurationEntity } from './entities/configuration.entity';
import { EntityManager, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';
import { CreateConfigurationDto, GetConfigurationDto } from './dto/configuration.dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class ConfigurationRepository {
  constructor(
    @InjectRepository(ConfigurationEntity)
    private repository: Repository<ConfigurationEntity>,
    private utilityService: UtilityService,
  ) {}

  async create(
    configuration: CreateConfigurationDto,
    entityManager?: EntityManager,
  ): Promise<ConfigurationEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ConfigurationEntity)
        : this.repository;
      return await repository.save(configuration);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: GetConfigurationDto): Promise<{
    records: ConfigurationEntity[];
    totalRecords: number;
  }> {
    try {
      const [configurations, total] = await this.repository.findAndCount({
        where: options,
      });
      return this.utilityService.listResponse(configurations, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<ConfigurationEntity>): Promise<ConfigurationEntity> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOneOrFail(options: FindOneOptions<ConfigurationEntity>): Promise<ConfigurationEntity> {
    try {
      return await this.repository.findOneOrFail(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<ConfigurationEntity>,
    updateData: Partial<ConfigurationEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ConfigurationEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
