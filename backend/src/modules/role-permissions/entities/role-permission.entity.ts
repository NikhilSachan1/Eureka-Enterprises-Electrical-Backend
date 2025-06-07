import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { RoleEntity } from '../../roles/entities/role.entity';
import { PermissionEntity } from '../../permissions/entities/permission.entity';

@Entity('role_permissions')
export class RolePermissionEntity extends BaseEntity {
  @Column({ name: 'roleId' })
  roleId: string;

  @Column({ name: 'permissionId' })
  permissionId: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string;

  @Index('IDX_ROLE_PERMISSIONS_ROLE_ID')
  @ManyToOne(() => RoleEntity, (role) => role.rolePermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;

  @Index('IDX_ROLE_PERMISSIONS_PERMISSION_ID')
  @ManyToOne(() => PermissionEntity, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionId' })
  permission: PermissionEntity;
}
