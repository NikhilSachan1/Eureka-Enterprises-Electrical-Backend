import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { FindManyOptions, Like, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { AuditLogRepository } from './audit-log.repository';
import { RequestAuditLogEntity } from './entities/request-audit-log.entity';
import { EntityAuditLogEntity, EntityAuditAction } from './entities/entity-audit-log.entity';
import {
  RequestAuditLogQueryDto,
  EntityAuditLogQueryDto,
  CleanupAuditLogsDto,
} from './dto/audit-log-query.dto';
import {
  AUDIT_LOG_ERRORS,
  AUDIT_LOG_RESPONSES,
  AUDIT_LOG_CONSTANTS,
} from './constants/audit-log.constants';
import {
  maskSensitiveData,
  truncateBody,
  extractSafeHeaders,
  getChangedFields,
} from './utils/sensitive-data-mask.util';
import { CAPTURED_HEADERS } from './constants/audit-log.constants';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  // ==================== REQUEST AUDIT LOGS ====================

  async createRequestLog(data: {
    correlationId: string;
    method: string;
    url: string;
    queryParams?: any;
    requestBody?: any;
    requestHeaders?: any;
    responseStatus?: number;
    responseBody?: any;
    responseTimeMs?: number;
    errorMessage?: string;
    errorStack?: string;
    userId?: string;
    userIp?: string;
    userAgent?: string;
  }): Promise<RequestAuditLogEntity> {
    try {
      const maskedData = {
        ...data,
        requestBody: truncateBody(maskSensitiveData(data.requestBody)),
        responseBody: truncateBody(maskSensitiveData(data.responseBody)),
        requestHeaders: extractSafeHeaders(data.requestHeaders, CAPTURED_HEADERS),
        timestamp: new Date(),
      };

      // Save asynchronously to not block the response
      return this.auditLogRepository.createRequestLog(maskedData);
    } catch (error) {
      this.logger.error(`Failed to create request audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllRequestLogs(query: RequestAuditLogQueryDto): Promise<{
    stats: any;
    records: RequestAuditLogEntity[];
    totalRecords: number;
  }> {
    try {
      const {
        correlationId,
        userId,
        method,
        url,
        responseStatus,
        minStatus,
        maxStatus,
        fromDate,
        toDate,
        errorsOnly,
        sortField = 'timestamp',
        sortOrder = 'DESC',
        page = 1,
        pageSize = 10,
      } = query;

      const where: any = {};

      if (correlationId) where.correlationId = correlationId;
      if (userId) where.userId = userId;
      if (method) where.method = method;
      if (url) where.url = Like(`%${url}%`);
      if (responseStatus) where.responseStatus = responseStatus;

      if (minStatus && maxStatus) {
        where.responseStatus = Between(minStatus, maxStatus);
      } else if (minStatus) {
        where.responseStatus = MoreThanOrEqual(minStatus);
      } else if (maxStatus) {
        where.responseStatus = LessThanOrEqual(maxStatus);
      }

      if (fromDate && toDate) {
        where.timestamp = Between(new Date(fromDate), new Date(toDate));
      } else if (fromDate) {
        where.timestamp = MoreThanOrEqual(new Date(fromDate));
      } else if (toDate) {
        where.timestamp = LessThanOrEqual(new Date(toDate));
      }

      if (errorsOnly) {
        where.responseStatus = MoreThanOrEqual(400);
      }

      const options: FindManyOptions<RequestAuditLogEntity> = {
        where,
        order: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      };

      const [result, stats] = await Promise.all([
        this.auditLogRepository.findAllRequestLogs(options),
        this.auditLogRepository.getRequestStats(),
      ]);

      return {
        stats,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to find request audit logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneRequestLog(id: string): Promise<RequestAuditLogEntity> {
    const log = await this.auditLogRepository.findOneRequestLog({ where: { id } });
    if (!log) {
      throw new NotFoundException(AUDIT_LOG_ERRORS.NOT_FOUND);
    }
    return log;
  }

  async findRequestLogsByCorrelation(correlationId: string): Promise<RequestAuditLogEntity[]> {
    const { records } = await this.auditLogRepository.findAllRequestLogs({
      where: { correlationId },
      order: { timestamp: 'ASC' },
    });
    return records;
  }

  // ==================== ENTITY AUDIT LOGS ====================

  async createEntityLog(data: {
    correlationId?: string;
    entityName: string;
    entityId: string;
    action: EntityAuditAction;
    oldValues?: any;
    newValues?: any;
    changedBy?: string;
  }): Promise<EntityAuditLogEntity> {
    try {
      const maskedOldValues = maskSensitiveData(data.oldValues);
      const maskedNewValues = maskSensitiveData(data.newValues);
      const changedFields = getChangedFields(data.oldValues, data.newValues);

      return this.auditLogRepository.createEntityLog({
        ...data,
        oldValues: maskedOldValues,
        newValues: maskedNewValues,
        changedFields,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to create entity audit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllEntityLogs(query: EntityAuditLogQueryDto): Promise<{
    stats: any;
    records: EntityAuditLogEntity[];
    totalRecords: number;
  }> {
    try {
      const {
        correlationId,
        entityName,
        entityId,
        action,
        changedBy,
        fromDate,
        toDate,
        sortField = 'timestamp',
        sortOrder = 'DESC',
        page = 1,
        pageSize = 10,
      } = query;

      const where: any = {};

      if (correlationId) where.correlationId = correlationId;
      if (entityName) where.entityName = entityName;
      if (entityId) where.entityId = entityId;
      if (action) where.action = action;
      if (changedBy) where.changedBy = changedBy;

      if (fromDate && toDate) {
        where.timestamp = Between(new Date(fromDate), new Date(toDate));
      } else if (fromDate) {
        where.timestamp = MoreThanOrEqual(new Date(fromDate));
      } else if (toDate) {
        where.timestamp = LessThanOrEqual(new Date(toDate));
      }

      const options: FindManyOptions<EntityAuditLogEntity> = {
        where,
        order: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      };

      const [result, stats] = await Promise.all([
        this.auditLogRepository.findAllEntityLogs(options),
        this.auditLogRepository.getEntityStats(),
      ]);

      return {
        stats,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to find entity audit logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOneEntityLog(id: string): Promise<EntityAuditLogEntity> {
    const log = await this.auditLogRepository.findOneEntityLog({ where: { id } });
    if (!log) {
      throw new NotFoundException(AUDIT_LOG_ERRORS.NOT_FOUND);
    }
    return log;
  }

  async getEntityHistory(entityName: string, entityId: string): Promise<EntityAuditLogEntity[]> {
    const { records } = await this.auditLogRepository.findAllEntityLogs({
      where: { entityName, entityId },
      order: { timestamp: 'DESC' },
    });
    return records;
  }

  // ==================== STATISTICS ====================

  async getStats(): Promise<{
    requestStats: any;
    entityStats: any;
    topEndpoints: any[];
    topEntities: any[];
  }> {
    try {
      const [requestStats, entityStats, topEndpoints, topEntities] = await Promise.all([
        this.auditLogRepository.getRequestStats(),
        this.auditLogRepository.getEntityStats(),
        this.auditLogRepository.getTopEndpoints(10),
        this.auditLogRepository.getTopEntities(10),
      ]);

      return {
        requestStats,
        entityStats,
        topEndpoints,
        topEntities,
      };
    } catch (error) {
      this.logger.error(`Failed to get audit stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ==================== CLEANUP ====================

  async cleanup(
    dto: CleanupAuditLogsDto,
  ): Promise<{ message: string; deletedRequestLogs: number; deletedEntityLogs: number }> {
    try {
      const days = dto.days || AUDIT_LOG_CONSTANTS.DEFAULT_RETENTION_DAYS;

      if (days < 1) {
        throw new BadRequestException(AUDIT_LOG_ERRORS.INVALID_DAYS);
      }

      const [deletedRequestLogs, deletedEntityLogs] = await Promise.all([
        this.auditLogRepository.cleanupRequestLogs(days),
        this.auditLogRepository.cleanupEntityLogs(days),
      ]);

      const message =
        deletedRequestLogs === 0 && deletedEntityLogs === 0
          ? AUDIT_LOG_RESPONSES.NO_LOGS_TO_DELETE.replace('{days}', days.toString())
          : AUDIT_LOG_RESPONSES.CLEANUP_SUCCESS.replace(
              '{requestCount}',
              deletedRequestLogs.toString(),
            )
              .replace('{entityCount}', deletedEntityLogs.toString())
              .replace('{days}', days.toString());

      this.logger.log(
        `Audit logs cleanup: ${deletedRequestLogs} request logs and ${deletedEntityLogs} entity logs deleted (older than ${days} days)`,
      );

      return {
        message,
        deletedRequestLogs,
        deletedEntityLogs,
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup audit logs: ${error.message}`, error.stack);
      throw error;
    }
  }
}
