import { Injectable, Logger } from '@nestjs/common';
import { CommunicationLogRepository } from './communication-log.repository';
import { CommunicationLogEntity } from './entities/communication-log.entity';
import {
  CommunicationChannel,
  CommunicationStatus,
  CommunicationCategory,
  CommunicationPriority,
} from './constants/communication-log.constants';
import {
  CreateCommunicationLogDto,
  UpdateCommunicationLogDto,
  LogEmailDto,
  LogWhatsAppDto,
  CommunicationLogQueryDto,
  CommunicationLogStatsDto,
} from './dto/communication-log.dto';
import { EntityManager, Between, FindOptionsWhere } from 'typeorm';
import {
  buildCommunicationLogStatsQuery,
  buildChannelStatsQuery,
  buildCategoryStatsQuery,
  buildStatusStatsQuery,
} from './queries';

@Injectable()
export class CommunicationLogService {
  constructor(private readonly repository: CommunicationLogRepository) {}

  async create(
    data: CreateCommunicationLogDto,
    entityManager?: EntityManager,
  ): Promise<CommunicationLogEntity> {
    try {
      return await this.repository.create(
        {
          ...data,
          status: data.status || CommunicationStatus.PENDING,
          category: data.category || CommunicationCategory.OTHER,
          priority: data.priority || CommunicationPriority.NORMAL,
        },
        entityManager,
      );
    } catch (error) {
      Logger.error('Failed to create communication log:', error);
      throw error;
    }
  }

  async logEmail(
    data: LogEmailDto,
    status: CommunicationStatus = CommunicationStatus.PENDING,
    errorInfo?: { message?: string; code?: string; details?: Record<string, any> },
  ): Promise<CommunicationLogEntity> {
    const startTime = Date.now();

    const logData: CreateCommunicationLogDto = {
      channel: CommunicationChannel.EMAIL,
      status,
      category: data.category || CommunicationCategory.OTHER,
      priority: CommunicationPriority.NORMAL,
      recipientId: data.recipientId,
      recipientContact: data.recipientEmail,
      recipientName: data.recipientName,
      subject: data.subject,
      templateName: data.templateName,
      templateData: data.templateData,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      provider: 'NODEMAILER', // Update based on your email provider
      createdBy: data.createdBy,
      sentAt: status === CommunicationStatus.SENT ? new Date() : undefined,
      errorMessage: errorInfo?.message,
      errorCode: errorInfo?.code,
      errorDetails: errorInfo?.details,
      responseTimeMs: Date.now() - startTime,
    };

    return await this.create(logData);
  }

  async logWhatsApp(
    data: LogWhatsAppDto,
    status: CommunicationStatus = CommunicationStatus.PENDING,
    externalMessageId?: string,
    errorInfo?: { message?: string; code?: string; details?: Record<string, any> },
  ): Promise<CommunicationLogEntity> {
    const startTime = Date.now();

    const logData: CreateCommunicationLogDto = {
      channel: CommunicationChannel.WHATSAPP,
      status,
      category: data.category || CommunicationCategory.OTHER,
      priority: CommunicationPriority.NORMAL,
      recipientId: data.recipientId,
      recipientContact: data.recipientPhone,
      recipientName: data.recipientName,
      templateName: data.templateName,
      templateData: data.templateData,
      messageContent: data.messageContent,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      provider: 'TWILIO', // Update based on your WhatsApp provider
      externalMessageId,
      createdBy: data.createdBy,
      sentAt: status === CommunicationStatus.SENT ? new Date() : undefined,
      errorMessage: errorInfo?.message,
      errorCode: errorInfo?.code,
      errorDetails: errorInfo?.details,
      responseTimeMs: Date.now() - startTime,
    };

    return await this.create(logData);
  }

  async update(
    id: string,
    data: UpdateCommunicationLogDto,
    entityManager?: EntityManager,
  ): Promise<void> {
    try {
      await this.repository.update(id, data, entityManager);
    } catch (error) {
      Logger.error(`Failed to update communication log ${id}:`, error);
      throw error;
    }
  }

  async markAsSent(id: string, externalMessageId?: string, responseTimeMs?: number): Promise<void> {
    await this.update(id, {
      status: CommunicationStatus.SENT,
      sentAt: new Date(),
      externalMessageId,
      responseTimeMs,
    });
  }

  async markAsFailed(
    id: string,
    errorMessage: string,
    errorCode?: string,
    errorDetails?: Record<string, any>,
  ): Promise<void> {
    const log = await this.repository.findOne({ where: { id } });

    await this.update(id, {
      status: CommunicationStatus.FAILED,
      errorMessage,
      errorCode,
      errorDetails,
      retryCount: (log?.retryCount || 0) + 1,
    });
  }

  async markAsDelivered(id: string): Promise<void> {
    await this.update(id, {
      status: CommunicationStatus.DELIVERED,
      deliveredAt: new Date(),
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.update(id, {
      status: CommunicationStatus.READ,
      readAt: new Date(),
    });
  }

  async findById(id: string): Promise<CommunicationLogEntity | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['recipient'],
    });
  }

  async findByExternalMessageId(externalMessageId: string): Promise<CommunicationLogEntity | null> {
    return await this.repository.findOne({
      where: { externalMessageId },
    });
  }

  async findAll(query: CommunicationLogQueryDto): Promise<{
    records: CommunicationLogEntity[];
    total: number;
  }> {
    const {
      channel,
      status,
      category,
      recipientId,
      recipientContact,
      referenceId,
      referenceType,
      fromDate,
      toDate,
      page = 1,
      pageSize = 20,
      sortField = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const where: FindOptionsWhere<CommunicationLogEntity> = {};

    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (category) where.category = category;
    if (recipientId) where.recipientId = recipientId;
    if (recipientContact) where.recipientContact = recipientContact;
    if (referenceId) where.referenceId = referenceId;
    if (referenceType) where.referenceType = referenceType;
    if (fromDate && toDate) {
      where.createdAt = Between(fromDate, toDate);
    }

    return await this.repository.findAll({
      where,
      relations: ['recipient'],
      order: { [sortField]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async getStats(fromDate?: Date, toDate?: Date): Promise<CommunicationLogStatsDto> {
    // Get main stats
    const { query: statsQuery, params: statsParams } = buildCommunicationLogStatsQuery(
      fromDate,
      toDate,
    );
    const statsResult = await this.repository.executeRawQuery(statsQuery, statsParams);

    // Get channel breakdown
    const { query: channelQuery, params: channelParams } = buildChannelStatsQuery(fromDate, toDate);
    const channelResult = await this.repository.executeRawQuery(channelQuery, channelParams);

    // Get category breakdown
    const { query: categoryQuery, params: categoryParams } = buildCategoryStatsQuery(
      fromDate,
      toDate,
    );
    const categoryResult = await this.repository.executeRawQuery(categoryQuery, categoryParams);

    // Get status breakdown
    const { query: statusQuery, params: statusParams } = buildStatusStatsQuery(fromDate, toDate);
    const statusResult = await this.repository.executeRawQuery(statusQuery, statusParams);

    // Transform array results to objects
    const byChannel: Record<string, number> = {};
    channelResult.forEach((row: { channel: string; count: string }) => {
      byChannel[row.channel || 'UNKNOWN'] = parseInt(row.count);
    });

    const byCategory: Record<string, number> = {};
    categoryResult.forEach((row: { category: string; count: string }) => {
      byCategory[row.category || 'OTHER'] = parseInt(row.count);
    });

    const byStatus: Record<string, number> = {};
    statusResult.forEach((row: { status: string; count: string }) => {
      byStatus[row.status || 'UNKNOWN'] = parseInt(row.count);
    });

    return {
      totalSent: parseInt(statsResult[0]?.totalSent || '0'),
      totalFailed: parseInt(statsResult[0]?.totalFailed || '0'),
      totalPending: parseInt(statsResult[0]?.totalPending || '0'),
      byChannel,
      byCategory,
      byStatus,
    };
  }

  async getFailedForRetry(limit = 100): Promise<CommunicationLogEntity[]> {
    const { records } = await this.repository.findAll({
      where: {
        status: CommunicationStatus.FAILED,
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return records;
  }

  async getRecipientHistory(recipientId: string, limit = 50): Promise<CommunicationLogEntity[]> {
    const { records } = await this.repository.findAll({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return records;
  }
}
