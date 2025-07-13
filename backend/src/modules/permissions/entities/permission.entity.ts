import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { RolePermissionEntity } from '../../role-permissions/entities/role-permission.entity';
import { UserPermissionEntity } from '../../user-permissions/entities/user-permission.entity';

@Entity('permissions')
export class PermissionEntity extends BaseEntity {
  @Index('IDX_PERMISSIONS_NAME')
  @Column({ type: 'text', unique: true })
  name: string;

  @Index('IDX_PERMISSIONS_MODULE')
  @Column({ type: 'text' })
  module: string;

  @Column({ type: 'text', nullable: true })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isEditable: boolean;

  @Column({ type: 'boolean', default: false })
  isDeletable: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string;

  @OneToMany(() => RolePermissionEntity, (rolePermission) => rolePermission.permission)
  rolePermissions: RolePermissionEntity[];

  @OneToMany(() => UserPermissionEntity, (userPermission) => userPermission.permission)
  userPermissions: UserPermissionEntity[];
}
