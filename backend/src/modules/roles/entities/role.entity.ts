import { UserRoleEntity } from 'src/modules/user-roles/entities/user-role.entity';
import { RolePermissionEntity } from 'src/modules/role-permissions/entities/role-permission.entity';
import {
  Column,
  Entity,
  OneToMany,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ROLES_NAME')
  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  isEditable: boolean;

  @Column({ type: 'boolean', default: false })
  isDeletable: boolean;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.role)
  userRoles: UserRoleEntity[];

  @OneToMany(() => RolePermissionEntity, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermissionEntity[];

  @CreateDateColumn({
    type: 'time with time zone',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'time with time zone',
  })
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
