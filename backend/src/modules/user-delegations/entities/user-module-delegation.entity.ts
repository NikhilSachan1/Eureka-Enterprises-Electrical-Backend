import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * One person allowed to act on another's behalf, for one module.
 *
 * This widens **whose** rows the manager may touch. It never widens **what** they may do — that
 * stays entirely with the permission tables. Someone who cannot approve an expense still cannot
 * approve one for the people they manage, which is the whole reason the two are kept apart.
 */
@Entity('user_module_delegations')
@Index('idx_delegation_manager_module', ['managerId', 'module'])
@Index('idx_delegation_member_module', ['memberId', 'module'])
export class UserModuleDelegationEntity extends BaseEntity {
  /** The person doing the work on somebody else's behalf. */
  @Column({ type: 'uuid' })
  managerId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'managerId' })
  manager: UserEntity;

  /** The person whose rows these are. The money stays theirs. */
  @Column({ type: 'uuid' })
  memberId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'memberId' })
  member: UserEntity;

  /**
   * A value from the `permission/modules` config — `expense`, `fuel`, and so on.
   *
   * A plain string rather than a database enum: that list is edited in config, and an enum would
   * need a migration every time somebody added a module. Only the modules the code actually
   * honours will match; anything else is simply inert.
   */
  @Column({ type: 'varchar', length: 64 })
  module: string;

  @Column({ type: 'date' })
  effectiveFrom: string;

  /** Null means "until further notice". Setting it is how a delegation is withdrawn. */
  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;
}
