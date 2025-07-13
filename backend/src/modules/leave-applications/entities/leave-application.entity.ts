import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { ConfigSettingEntity } from 'src/modules/config-settings/entities/config-setting.entity';

@Entity('leave_applications')
export class LeaveApplicationsEntity extends BaseEntity {
  @Column({ name: 'leaveConfigId' })
  leaveConfigId: string;

  @Column({ name: 'userId' })
  userId: string;

  @Column({ type: 'varchar' })
  leaveType: string;

  @Column({ type: 'timestamp' })
  fromDate: Date;

  @Column({ type: 'timestamp' })
  toDate: Date;

  @Column({ type: 'varchar' })
  reason: string;

  @Index('IDX_LEAVE_APPLICATIONS_APPROVAL_STATUS')
  @Column({ type: 'varchar' })
  approvalStatus: string;

  @Column({ name: 'approvalBy', nullable: true })
  approvalBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date;

  @Column({ type: 'varchar' })
  approvalReason: string;

  // Relations
  @Index('IDX_LEAVE_APPLICATIONS_USER_ID')
  @ManyToOne(() => UserEntity, (user) => user.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Index('IDX_LEAVE_APPLICATIONS_LEAVE_CONFIG_ID')
  @ManyToOne(() => ConfigSettingEntity, (config) => config.id, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'leaveConfigId' })
  leaveConfig: ConfigSettingEntity;

  @Index('IDX_LEAVE_APPLICATIONS_APPROVAL_BY')
  @ManyToOne(() => UserEntity, (user) => user.id, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'approvalBy' })
  approver: UserEntity;
}
