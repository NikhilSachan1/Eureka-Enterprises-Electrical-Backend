import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { LeaveLedgerEntryType } from '../constants/leave-ledger.constants';
import { LeaveLedgerMetadata } from '../types/leave-ledger.types';

/** One credit, debit or adjustment of a leave balance. Rows are only ever added. */
@Entity('leave_ledger_entries')
@Index('IDX_LEAVE_LEDGER_USER_FY', ['userId', 'leaveCategory', 'financialYear', 'createdAt'])
export class LeaveLedgerEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  leaveCategory: string;

  @Column({ type: 'varchar' })
  financialYear: string;

  @Column({ type: 'varchar' })
  entryType: LeaveLedgerEntryType;

  /** Signed: a credit or give-back is positive, a debit or claw-back negative. */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  days: string;

  /** First day of the month the entry settles or advances (YYYY-MM-01). */
  @Column({ type: 'date', nullable: true })
  periodMonth: string | null;

  @Column({ type: 'uuid', nullable: true })
  leaveApplicationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  attendanceId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: LeaveLedgerMetadata | null;

  @ManyToOne(() => UserEntity, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
