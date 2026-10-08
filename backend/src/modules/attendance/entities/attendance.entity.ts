import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('attendances')
export class AttendanceEntity extends BaseEntity {
  @Index('IDX_attendance_userId')
  @Column({ type: 'uuid' })
  userId: string;

  @Index('IDX_attendance_attendanceDate')
  @Column({ type: 'date' })
  attendanceDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkInTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  checkOutTime: Date;

  @Index('IDX_attendance_status')
  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  shiftConfigId: string;

  @Column({ type: 'text' })
  entrySourceType: string;

  @Column({ type: 'text' })
  attendanceType: string;

  @Column({ type: 'uuid', nullable: true })
  regularizedBy: string;

  @Column({ type: 'text' })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date;

  @Column({ type: 'text', nullable: true })
  approvalComment: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * What the employee actually chose on the day: the vehicle, and the engineer the pairing
   * resolved to.
   *
   * Site, company and contractors used to live here too. They do not any more — the project is
   * resolved from the employee's allocation for the attendance date on every read, so a stored
   * copy could only go stale the moment an allocation was corrected. Rows written before this
   * still carry those keys in the JSON; nothing reads them, and the sanitiser strips them from
   * anything written from now on.
   */
  @Column({ type: 'jsonb', nullable: true })
  assignmentSnapshot: {
    assignedEngineer?: { id: string; firstName: string; lastName: string; employeeId: string };
  };

  @Index('IDX_attendance_isActive')
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'regularizedBy' })
  regularizedByUser: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity;
}
