import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { DevicePlatform } from '../constants/notification.constants';

/**
 * One app install that can receive pushes.
 *
 * `token` is unique: if a second person logs in on the same phone, the row moves to them, and the
 * first person stops getting pushes on a phone they no longer hold.
 */
@Entity('user_devices')
export class UserDeviceEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  /** The FCM registration token the app got from `firebase_messaging`. */
  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'varchar', length: 16 })
  platform: DevicePlatform;

  /** The SNS platform endpoint for this token. Null until SNS has accepted it. */
  @Column({ type: 'text', nullable: true })
  endpointArn: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  appVersion: string | null;

  @Column({ type: 'timestamp' })
  lastSeenAt: Date;

  /** False after logout, or once SNS reports the token dead. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
