import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import {
  CommunicationChannel,
  CommunicationStatus,
  CommunicationCategory,
  CommunicationPriority,
} from '../constants/communication-log.constants';

@Entity('communication_logs')
@Index('idx_comm_logs_channel', ['channel'])
@Index('idx_comm_logs_status', ['status'])
@Index('idx_comm_logs_category', ['category'])
@Index('idx_comm_logs_recipient_id', ['recipientId'])
@Index('idx_comm_logs_created_at', ['createdAt'])
@Index('idx_comm_logs_channel_status', ['channel', 'status'])
export class CommunicationLogEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  channel: CommunicationChannel;

  @Column({ type: 'varchar', length: 50, default: CommunicationStatus.PENDING })
  status: CommunicationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: CommunicationCategory;

  @Column({ type: 'varchar', length: 20, default: CommunicationPriority.NORMAL })
  priority: CommunicationPriority;

  @Column({ type: 'uuid', nullable: true })
  recipientId?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'recipientId' })
  recipient?: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  recipientContact: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipientName?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  templateName?: string;

  @Column({ type: 'jsonb', nullable: true })
  templateData?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  messageContent?: string;

  @Column({ type: 'uuid', nullable: true })
  referenceId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referenceType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalMessageId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'integer', nullable: true })
  responseTimeMs?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  initiatedFromIp?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
