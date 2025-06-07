import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from '../../users/entities/user.entity';
import { PermissionEntity } from '../../permissions/entities/permission.entity';

@Entity('user_permission_overrides')
export class UserPermissionEntity extends BaseEntity {
  @Column({ name: 'userId' })
  userId: string;

  @Column({ name: 'permissionId' })
  permissionId: string;

  @Column({ type: 'boolean' })
  isGranted: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string;

  @Index('IDX_USER_PERMISSIONS_USER_ID')
  @ManyToOne(() => UserEntity, (user) => user.userPermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Index('IDX_USER_PERMISSIONS_PERMISSION_ID')
  @ManyToOne(() => PermissionEntity, (permission) => permission.userPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission: PermissionEntity;
}
