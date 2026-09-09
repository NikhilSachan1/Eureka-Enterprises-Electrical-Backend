import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * Which engineer a driver worked with on a given day.
 *
 * This exists because the pairing decides who receives the driver's daily food allowance, and it
 * used to be typed by the driver into `attendances.assignmentSnapshot` at check-in — the person
 * with the least reason to get it right. The engineer now states it as part of his own check-in,
 * and this table is the single source the server derives `assignedEngineer` from.
 *
 * One row per driver per day: the pairing genuinely changes day to day, so it is dated rather
 * than open-ended.
 */
@Entity('driver_day_assignments')
@Index('IDX_DRIVER_DAY_ASSIGNMENT_DRIVER', ['driverId'])
@Index('IDX_DRIVER_DAY_ASSIGNMENT_ENGINEER', ['engineerId'])
@Index('IDX_DRIVER_DAY_ASSIGNMENT_DATE', ['workDate'])
export class DriverAssignmentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  driverId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'driverId' })
  driver: UserEntity;

  @Column({ type: 'uuid' })
  engineerId: string;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'engineerId' })
  engineer: UserEntity;

  /** The day worked, not the day the row was created — corrections are backdated. */
  @Column({ type: 'date' })
  workDate: Date;
}
