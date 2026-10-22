import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * One thing that happened, for one person — what the bell lists and what a push says.
 *
 * Bell and push read the same row, so they cannot say different things. It belongs to the user,
 * not a device: read on the web means read in the app.
 *
 * Never put a password, OTP, reset link, bank detail or salary figure in `title`, `message` or
 * `data`. A push shows on the lock screen, and this row is kept for months.
 */
@Entity('notifications')
@Index('idx_notifications_user_read_created', ['userId', 'isRead', 'createdAt'])
export class NotificationEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  message: string;

  /** A `CommunicationCategory` value, so the bell and the communication logs group alike. */
  @Column({ type: 'varchar', length: 64 })
  category: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceType: string | null;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  /** Where a tap should open, e.g. `/expenses/<id>`. The app maps it to its own screen. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  route: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  /** Set by crons so a rerun does not post the same thing twice. Unique per user. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;
}
