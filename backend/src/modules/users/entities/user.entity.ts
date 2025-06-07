import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserRoleEntity } from 'src/modules/user-roles/entities/user-role.entity';
import { UserPermissionEntity } from 'src/modules/user-permissions/entities/user-permission.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Index('IDX_USER_EMAIL')
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordUpdatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profilePicture: string;

  @Index('IDX_USER_STATUS')
  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status: string;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.user)
  userRoles: UserRoleEntity[];

  @OneToMany(() => UserPermissionEntity, (userPermission) => userPermission.user)
  userPermissions: UserPermissionEntity[];
}
