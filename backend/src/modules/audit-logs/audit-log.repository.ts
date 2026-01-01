import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import { RequestAuditLogEntity } from './entities/request-audit-log.entity';
import { EntityAuditLogEntity } from './entities/entity-audit-log.entity';
import {
  buildRequestAuditCleanupQuery,
  buildEntityAuditCleanupQuery,
  buildRequestAuditStatsQuery,
  buildEntityAuditStatsQuery,
  buildTopEndpointsQuery,
  buildTopEntitiesQuery,
} from './queries/audit-log.queries';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(RequestAuditLogEntity)
    private readonly requestAuditRepository: Repository<RequestAuditLogEntity>,
    @InjectRepository(EntityAuditLogEntity)
    private readonly entityAuditRepository: Repository<EntityAuditLogEntity>,
  ) {}

  // Request Audit Methods
  async createRequestLog(data: Partial<RequestAuditLogEntity>): Promise<RequestAuditLogEntity> {
    const log = this.requestAuditRepository.create(data);
    return this.requestAuditRepository.save(log);
  }

  async findAllRequestLogs(
    options: FindManyOptions<RequestAuditLogEntity>,
  ): Promise<{ records: RequestAuditLogEntity[]; totalRecords: number }> {
    const [records, totalRecords] = await this.requestAuditRepository.findAndCount(options);
    return { records, totalRecords };
  }

  async findOneRequestLog(
    options: FindOneOptions<RequestAuditLogEntity>,
  ): Promise<RequestAuditLogEntity | null> {
    return this.requestAuditRepository.findOne(options);
  }

  async cleanupRequestLogs(days: number): Promise<number> {
    const { query, params } = buildRequestAuditCleanupQuery(days);
    const result = await this.requestAuditRepository.query(query, params);
    return result.length;
  }

  async getRequestStats(): Promise<any> {
    const { query, params } = buildRequestAuditStatsQuery();
    const [result] = await this.requestAuditRepository.query(query, params);
    return result;
  }

  async getTopEndpoints(limit = 10): Promise<any[]> {
    const { query, params } = buildTopEndpointsQuery(limit);
    return this.requestAuditRepository.query(query, params);
  }

  // Entity Audit Methods
  async createEntityLog(data: Partial<EntityAuditLogEntity>): Promise<EntityAuditLogEntity> {
    const log = this.entityAuditRepository.create(data);
    return this.entityAuditRepository.save(log);
  }

  async findAllEntityLogs(
    options: FindManyOptions<EntityAuditLogEntity>,
  ): Promise<{ records: EntityAuditLogEntity[]; totalRecords: number }> {
    const [records, totalRecords] = await this.entityAuditRepository.findAndCount(options);
    return { records, totalRecords };
  }

  async findOneEntityLog(
    options: FindOneOptions<EntityAuditLogEntity>,
  ): Promise<EntityAuditLogEntity | null> {
    return this.entityAuditRepository.findOne(options);
  }

  async cleanupEntityLogs(days: number): Promise<number> {
    const { query, params } = buildEntityAuditCleanupQuery(days);
    const result = await this.entityAuditRepository.query(query, params);
    return result.length;
  }

  async getEntityStats(): Promise<any> {
    const { query, params } = buildEntityAuditStatsQuery();
    const [result] = await this.entityAuditRepository.query(query, params);
    return result;
  }

  async getTopEntities(limit = 10): Promise<any[]> {
    const { query, params } = buildTopEntitiesQuery(limit);
    return this.entityAuditRepository.query(query, params);
  }

  // Execute raw query
  async executeRawQuery(query: string, params: any[] = []): Promise<any> {
    return this.requestAuditRepository.query(query, params);
  }
}
