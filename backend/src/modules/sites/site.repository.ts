import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  EntityManager,
  FindOneOptions,
  FindManyOptions,
  FindOptionsWhere,
} from 'typeorm';
import { SiteEntity } from './entities/site.entity';
import { SiteContractorEntity } from './entities/site-contractor.entity';
import { SiteStatusHistoryEntity } from './entities/site-status-history.entity';

@Injectable()
export class SiteRepository {
  constructor(
    @InjectRepository(SiteEntity)
    private readonly repository: Repository<SiteEntity>,
    @InjectRepository(SiteContractorEntity)
    private readonly siteContractorRepository: Repository<SiteContractorEntity>,
    @InjectRepository(SiteStatusHistoryEntity)
    private readonly statusHistoryRepository: Repository<SiteStatusHistoryEntity>,
  ) {}

  async create(
    createData: Partial<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteEntity> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      const site = repo.create(createData);
      return await repo.save(site);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findOne(
    options: FindOneOptions<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteEntity | null> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      return await repo.findOne(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async findAll(
    options: FindManyOptions<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteEntity[]> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      return await repo.find(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<SiteEntity>,
    updateData: Partial<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      await repo.update(identifierConditions, updateData);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async softDelete(
    identifierConditions: FindOptionsWhere<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      await repo.softDelete(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async restore(
    identifierConditions: FindOptionsWhere<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      await repo.restore(identifierConditions);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async count(
    options: FindManyOptions<SiteEntity>,
    entityManager?: EntityManager,
  ): Promise<number> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      return await repo.count(options);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  // Site Contractor methods
  async addContractors(
    siteId: string,
    contractorIds: string[],
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteContractorEntity)
        : this.siteContractorRepository;

      const siteContractors = contractorIds.map((contractorId) =>
        repo.create({ siteId, contractorId }),
      );
      await repo.save(siteContractors);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async removeContractors(
    siteId: string,
    contractorIds?: string[],
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteContractorEntity)
        : this.siteContractorRepository;

      if (contractorIds && contractorIds.length > 0) {
        await repo
          .createQueryBuilder()
          .delete()
          .where('siteId = :siteId AND contractorId IN (:...contractorIds)', {
            siteId,
            contractorIds,
          })
          .execute();
      } else {
        await repo.delete({ siteId });
      }
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getContractorsBySiteId(
    siteId: string,
    entityManager?: EntityManager,
  ): Promise<SiteContractorEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteContractorEntity)
        : this.siteContractorRepository;

      return await repo.find({
        where: { siteId },
        relations: ['contractor'],
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async executeRawQuery(query: string, params: any[], entityManager?: EntityManager): Promise<any> {
    try {
      const repo = entityManager ? entityManager.getRepository(SiteEntity) : this.repository;
      return await repo.query(query, params);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async createStatusHistory(
    data: Partial<SiteStatusHistoryEntity>,
    entityManager?: EntityManager,
  ): Promise<SiteStatusHistoryEntity> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteStatusHistoryEntity)
        : this.statusHistoryRepository;
      const history = repo.create(data);
      return await repo.save(history);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }

  async getStatusHistory(
    siteId: string,
    entityManager?: EntityManager,
  ): Promise<SiteStatusHistoryEntity[]> {
    try {
      const repo = entityManager
        ? entityManager.getRepository(SiteStatusHistoryEntity)
        : this.statusHistoryRepository;

      return await repo.find({
        where: { siteId },
        order: { changedAt: 'DESC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
