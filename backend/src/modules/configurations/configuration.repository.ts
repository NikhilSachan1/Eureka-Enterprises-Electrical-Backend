import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigurationEntity } from './entities/configuration.entity';
import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  Repository,
} from 'typeorm';
import { CreateConfigurationDto, GetConfigurationDto } from './dto/configuration.dto';
import { UtilityService } from 'src/utils/utility/utility.service';
import { SortOrder } from 'src/utils/utility/constants/utility.constants';

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

  async findAll(options: FindManyOptions<ConfigurationEntity> & GetConfigurationDto): Promise<{
    records: ConfigurationEntity[];
    totalRecords: number;
  }> {
    try {
      const { page, pageSize, sortField, sortOrder, search, ...rest } = options as any;
      const where: FindOptionsWhere<ConfigurationEntity> = { deletedAt: null };
      if (search) {
        where.key = ILike(`%${search}%`);
        where.label = ILike(`%${search}%`);
      }
      if (sortField && sortOrder) {
        where[sortField] = sortOrder === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC;
      }
      //pass rest to where as well
      Object.assign(where, rest);
      const [configurations, total] = await this.repository.findAndCount({
        skip: page ? (page - 1) * pageSize : undefined,
        take: pageSize ? pageSize : undefined,
        where,
        relations: ['configSettings'],
        select: {
          id: true,
          module: true,
          key: true,
          label: true,
          valueType: true,
          isEditable: true,
          description: true,
          configSettings: {
            id: true,
            contextKey: true,
            value: true,
            effectiveFrom: true,
            effectiveTo: true,
            isActive: true,
          },
        },
      });
      return this.utilityService.listResponse(configurations, total);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<ConfigurationEntity>,
    entityManager?: EntityManager,
  ): Promise<ConfigurationEntity> {
    try {
      const repository = entityManager
        ? entityManager.getRepository(ConfigurationEntity)
        : this.repository;
      return await repository.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAllWithActiveConfigSettings(options: GetConfigurationDto): Promise<{
    records: ConfigurationEntity[];
    totalRecords: number;
  }> {
    try {
      const {
        page,
        pageSize,
        sortField = 'createdAt',
        sortOrder = SortOrder.DESC,
        search,
        module,
        key,
      } = options;

      // Base query for configurations
      const query = this.repository.createQueryBuilder('config');

      // Base where conditions - only non-deleted configurations
      query.where('config.deletedAt IS NULL');

      // Module filter (exact match)
      if (module) {
        query.andWhere('config.module = :module', { module });
      }

      // Key filter (exact match)
      if (key) {
        query.andWhere('config.key = :key', { key });
      }

      // Search in key OR label (case-insensitive)
      if (search?.trim()) {
        query.andWhere('(config.key ILIKE :search OR config.label ILIKE :search)', {
          search: `%${search.trim()}%`,
        });
      }

      // Join configSettings but only active ones
      query.leftJoinAndSelect('config.configSettings', 'cs', 'cs.isActive = :isActive', {
        isActive: true,
      });

      // Count total (before pagination)
      const totalQuery = query.clone();
      const total = await totalQuery.getCount();

      // Sorting - validate sortField
      const allowedSortFields = ['createdAt', 'updatedAt', 'module', 'key', 'label'];
      const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'createdAt';
      const order = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
      query.orderBy(`config.${safeSortField}`, order as 'ASC' | 'DESC');

      // Pagination - only if both page and pageSize provided
      if (page && pageSize && page > 0 && pageSize > 0) {
        query.skip((page - 1) * pageSize).take(pageSize);
      }

      // Execute query and get results
      const configurations = await query.getMany();

      return this.utilityService.listResponse(configurations, total);
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
