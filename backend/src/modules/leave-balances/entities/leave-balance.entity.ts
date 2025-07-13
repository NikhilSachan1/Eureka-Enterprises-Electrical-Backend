import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { ConfigSettingEntity } from 'src/modules/config-settings/entities/config-setting.entity';

@Entity('leave_balances')
export class LeaveBalanceEntity extends BaseEntity {
  @Column({ name: 'userId' })
  userId: string;

  @Column({ name: 'leaveConfigId' })
  leaveConfigId: string;

  @Column({ type: 'varchar' })
  leaveCategory: string;

  @Column({ type: 'varchar' })
  financialYear: string;

  @Column({ type: 'varchar' })
  creditSource: string;

  @Column({ type: 'varchar' })
  totalAllocated: string;

  @Column({ type: 'varchar', default: '0' })
  carriedForward: string;

  @Column({ type: 'varchar', default: '0' })
  consumed: string;

  @Column({ type: 'varchar', default: '0' })
  adjusted: string;

  @Column({ type: 'varchar', nullable: true })
  notes?: string;

  // Foreign key relationships
  @Index('IDX_LEAVE_BALANCES_USER_ID')
  @ManyToOne(() => UserEntity, (user) => user.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => ConfigSettingEntity, (configSetting) => configSetting.id, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'leaveConfigId' })
  leaveConfig: ConfigSettingEntity;
}
