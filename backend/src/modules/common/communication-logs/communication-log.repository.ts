import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions, FindManyOptions, EntityManager } from 'typeorm';
import { CommunicationLogEntity } from './entities/communication-log.entity';

@Injectable()
export class CommunicationLogRepository {
  constructor(
    @InjectRepository(CommunicationLogEntity)
    private readonly repository: Repository<CommunicationLogEntity>,
  ) {}

  async create(
    data: Partial<CommunicationLogEntity>,
    entityManager?: EntityManager,
  ): Promise<CommunicationLogEntity> {
    const repo = entityManager
      ? entityManager.getRepository(CommunicationLogEntity)
      : this.repository;
    const entity = repo.create(data);
    return await repo.save(entity);
  }

  async findOne(
    options: FindOneOptions<CommunicationLogEntity>,
    entityManager?: EntityManager,
  ): Promise<CommunicationLogEntity | null> {
    const repo = entityManager
      ? entityManager.getRepository(CommunicationLogEntity)
      : this.repository;
    return await repo.findOne(options);
  }

  async findAll(
    options?: FindManyOptions<CommunicationLogEntity>,
  ): Promise<{ records: CommunicationLogEntity[]; total: number }> {
    const [records, total] = await this.repository.findAndCount(options);
    return { records, total };
  }

  async update(
    id: string,
    data: Partial<CommunicationLogEntity>,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repo = entityManager
      ? entityManager.getRepository(CommunicationLogEntity)
      : this.repository;
    await repo.update({ id }, data);
  }

  async executeRawQuery(query: string, params?: any[]): Promise<any> {
    return await this.repository.query(query, params);
  }
}
