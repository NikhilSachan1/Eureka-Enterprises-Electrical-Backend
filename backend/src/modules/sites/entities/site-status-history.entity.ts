import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from './site.entity';
import { SiteStatus } from '../constants/site.constants';

@Entity('site_status_history')
@Index('IDX_SITE_STATUS_HISTORY_SITE', ['siteId'])
@Index('IDX_SITE_STATUS_HISTORY_CHANGED_AT', ['changedAt'])
export class SiteStatusHistoryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  // Previous status (null for initial status when site is created)
  @Column({ type: 'varchar', length: 20, nullable: true })
  fromStatus: SiteStatus | null;

  // New status
  @Column({ type: 'varchar', length: 20 })
  toStatus: SiteStatus;

  // Optional reason for the status change
  @Column({ type: 'text', nullable: true })
  reason: string;

  // When the status was changed
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  // Who made the change (stored separately for quick access, also in createdBy)
  @Column({ type: 'uuid' })
  changedBy: string;
}
