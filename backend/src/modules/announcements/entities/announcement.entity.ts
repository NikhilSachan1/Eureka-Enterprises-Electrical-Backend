import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { AnnouncementTargetEntity } from './announcement-target.entity';
import { UserAnnouncementAckEntity } from './user-announcement-ack.entity';

@Entity('announcements')
export class AnnouncementEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Index('IDX_ANNOUNCEMENT_STATUS')
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Index('IDX_ANNOUNCEMENT_START_AT')
  @Column({ type: 'timestamp', nullable: true })
  startAt: Date;

  @Index('IDX_ANNOUNCEMENT_EXPIRY_AT')
  @Column({ type: 'timestamp', nullable: true })
  expiryAt: Date;

  @OneToMany(() => AnnouncementTargetEntity, (target) => target.announcement)
  targets: AnnouncementTargetEntity[];

  @OneToMany(() => UserAnnouncementAckEntity, (ack) => ack.announcement)
  acknowledgements: UserAnnouncementAckEntity[];
}
