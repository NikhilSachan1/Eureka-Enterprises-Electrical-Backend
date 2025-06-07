import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigSettingEntity } from './entities/config-setting.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import { CreateConfigSettingDto, GetConfigSettingDto } from './dto';
import { UtilityService } from 'src/utils/utility/utility.service';

@Injectable()
export class ConfigSettingRepository {
  constructor(
    @InjectRepository(ConfigSettingEntity)
    private repository: Repository<ConfigSettingEntity>,
    private utilityService: UtilityService,
  ) {}

  async create(
    configSetting: CreateConfigSettingDto,
    entityManager?: EntityManager,
  ): Promise<ConfigSettingEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ConfigSettingEntity)
        : this.repository;
      return await repository.save(configSetting);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(options: FindManyOptions<ConfigSettingEntity> & GetConfigSettingDto): Promise<{
    records: ConfigSettingEntity[];
    totalRecords: number;
  }> {
    try {
      const [configSettings, total] = await this.repository.findAndCount({
        where: options,
      });
      return this.utilityService.listResponse(configSettings, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(options: FindOneOptions<ConfigSettingEntity>): Promise<ConfigSettingEntity> {
    try {
      return await this.repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<ConfigSettingEntity>,
    updateData: Partial<ConfigSettingEntity>,
    entityManager?: EntityManager,
  ) {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ConfigSettingEntity)
        : this.repository;
      return await repository.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
