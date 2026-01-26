import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { SITE_ALLOCATION_DEFAULTS } from '../constants/site-allocation.constants';

@Entity('site_allocations')
export class SiteAllocationEntity extends BaseEntity {
  // Foreign key to sites table
  @Index('IDX_SITE_ALLOCATION_SITE_ID')
  @Column({ type: 'uuid' })
  siteId: string;

  // Foreign key to users table (employee)
  @Index('IDX_SITE_ALLOCATION_USER_ID')
  @Column({ type: 'uuid' })
  userId: string;

  // Allocation type (full_time, part_time) - config-driven
  @Column({ type: 'varchar', length: 50, default: SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE })
  allocationType: string;

  // Role at site (Engineer, Supervisor, etc.) - config-driven
  @Column({ type: 'varchar', length: 100, default: SITE_ALLOCATION_DEFAULTS.ROLE })
  role: string;

  // Daily allowance for the employee at this site
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE,
  })
  dailyAllowance: number;

  // Date when employee was allocated to the site
  @Column({ type: 'date' })
  allocatedAt: Date;

  // Date when employee was deallocated (null if still allocated)
  @Column({ type: 'date', nullable: true })
  deallocatedAt: Date;

  // Is currently allocated (quick filter field)
  @Index('IDX_SITE_ALLOCATION_IS_CURRENT')
  @Column({ type: 'boolean', default: true })
  isCurrentlyAllocated: boolean;

  // Additional remarks/notes
  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Relation to Site
  @ManyToOne(() => SiteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  // Relation to User (employee)
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
