import { RoleEntity } from 'src/modules/roles/entities/role.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Entity, JoinColumn, ManyToOne, Index, Column } from 'typeorm';

@Entity('user-roles')
export class UserRoleEntity extends BaseEntity {
  @Column({ name: 'userId' })
  userId: string;

  @Column({ name: 'roleId' })
  roleId: string;

  @Index('IDX_USER_ROLES_USER_ID')
  @ManyToOne(() => UserEntity, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Index('IDX_USER_ROLES_ROLE_ID')
  @ManyToOne(() => RoleEntity, (role) => role.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role: RoleEntity;
}
