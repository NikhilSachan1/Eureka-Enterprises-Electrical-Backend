import {
  CommunicationChannel,
  CommunicationStatus,
  CommunicationCategory,
  CommunicationPriority,
} from '../constants/communication-log.constants';

export interface CreateCommunicationLogDto {
  channel: CommunicationChannel;
  status?: CommunicationStatus;
  category?: CommunicationCategory;
  priority?: CommunicationPriority;
  recipientId?: string;
  recipientContact: string;
  recipientName?: string;
  subject?: string;
  templateName?: string;
  templateData?: Record<string, any>;
  messageContent?: string;
  referenceId?: string;
  referenceType?: string;
  externalMessageId?: string;
  provider?: string;
  errorMessage?: string;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  responseTimeMs?: number;
  initiatedFromIp?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  sentAt?: Date;
}

export interface UpdateCommunicationLogDto {
  status?: CommunicationStatus;
  externalMessageId?: string;
  errorMessage?: string;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  retryCount?: number;
  nextRetryAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  responseTimeMs?: number;
  metadata?: Record<string, any>;
}

export interface LogEmailDto {
  recipientEmail: string;
  recipientName?: string;
  recipientId?: string;
  subject: string;
  templateName: string;
  templateData?: Record<string, any>;
  category?: CommunicationCategory;
  referenceId?: string;
  referenceType?: string;
  createdBy?: string;
}

export interface LogWhatsAppDto {
  recipientPhone: string;
  recipientName?: string;
  recipientId?: string;
  templateName?: string;
  templateData?: Record<string, any>;
  messageContent?: string;
  category?: CommunicationCategory;
  referenceId?: string;
  referenceType?: string;
  createdBy?: string;
}

export interface CommunicationLogQueryDto {
  channel?: CommunicationChannel;
  status?: CommunicationStatus;
  category?: CommunicationCategory;
  recipientId?: string;
  recipientContact?: string;
  referenceId?: string;
  referenceType?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CommunicationLogStatsDto {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  byChannel: Record<CommunicationChannel, number>;
  byCategory: Record<string, number>;
  byStatus: Record<CommunicationStatus, number>;
}
