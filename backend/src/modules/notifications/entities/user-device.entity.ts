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

  /**
   * Where Firebase delivers this device's pushes: a 22-character Firebase Installation ID from the
   * app (`firebase_messaging` 17+, `register()` / `onRegistered`), or a longer registration token
   * from the web SDK. The push sender tells them apart.
   */
  @Column({ type: 'text', unique: true })
  token: string;

  @Column({ type: 'varchar', length: 16 })
  platform: DevicePlatform;

  /**
   * Unused since push moved from AWS SNS to direct FCM (2026-10-26) — FCM needs no per-device
   * registration. Left in place rather than dropped with a migration; safe to remove later.
   */
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
