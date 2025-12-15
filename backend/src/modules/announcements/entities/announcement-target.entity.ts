import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { AnnouncementEntity } from './announcement.entity';

@Entity('announcement_targets')
@Unique('uniq_announcement_target', ['announcementId', 'targetType', 'targetId'])
export class AnnouncementTargetEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  announcementId: string;

  @Index('IDX_ANNOUNCEMENT_TARGET_TYPE')
  @Column({ type: 'varchar', length: 20 })
  targetType: string;

  @Index('IDX_ANNOUNCEMENT_TARGET_ID')
  @Column({ type: 'uuid' })
  targetId: string;

  @ManyToOne(() => AnnouncementEntity, (announcement) => announcement.targets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'announcementId' })
  announcement: AnnouncementEntity;
}
