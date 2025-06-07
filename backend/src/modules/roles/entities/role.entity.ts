import { UserRoleEntity } from 'src/modules/user-roles/entities/user-role.entity';
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
  description: string;

  @OneToMany(() => UserRoleEntity, (userRole) => userRole.role)
  userRoles: UserRoleEntity[];

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
