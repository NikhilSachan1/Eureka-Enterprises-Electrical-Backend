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
