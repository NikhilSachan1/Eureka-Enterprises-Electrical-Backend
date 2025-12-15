import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { AnnouncementEntity } from './announcement.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('user_announcement_ack')
@Unique('uniq_user_announcement_ack', ['announcementId', 'userId'])
export class UserAnnouncementAckEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  announcementId: string;

  @Index('IDX_USER_ANNOUNCEMENT_ACK_USER_ID')
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @ManyToOne(() => AnnouncementEntity, (announcement) => announcement.acknowledgements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'announcementId' })
  announcement: AnnouncementEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
