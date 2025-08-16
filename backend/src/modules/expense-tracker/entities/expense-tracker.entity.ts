import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('expenses')
@Index('idx_expenses_userId', ['userId'])
@Index('idx_expenses_approvalBy', ['approvalBy'])
@Index('idx_expenses_approvalStatus', ['approvalStatus'])
@Index('idx_expenses_originalExpenseId', ['originalExpenseId']) // New index
@Index('idx_expenses_isActive', ['isActive'])
export class ExpenseTrackerEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', nullable: false })
  category: string;

  @Column({ type: 'varchar', nullable: false })
  description: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  isActive: boolean;

  @Column({ type: 'decimal', nullable: false })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  transactionId: string;

  @Column({ type: 'timestamp', nullable: false })
  expenseDate: Date;

  @Column({ type: 'varchar', nullable: false })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date;

  @Column({ type: 'varchar', nullable: true })
  approvalReason: string;

  @Column({ type: 'varchar', nullable: false })
  transactionType: string;

  @Column({ type: 'varchar', nullable: false })
  paymentMode: string;

  @Column({ type: 'text', nullable: false })
  entrySourceType: string;

  @Column({ type: 'text', nullable: false })
  expenseEntryType: string;

  // NEW FIELDS FOR HISTORY TRACKING
  @Column({ type: 'uuid', nullable: true })
  originalExpenseId: string; // Points to the very first expense record

  @Column({ type: 'uuid', nullable: true })
  parentExpenseId: string; // Points to the immediate previous version

  @Column({ type: 'integer', nullable: false, default: 1 })
  versionNumber: number; // Version sequence (1, 2, 3, etc.)

  @Column({ type: 'varchar', nullable: true })
  editReason: string;

  // Relationships
  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity;

  // Self-referencing relationships for history
  @ManyToOne(() => ExpenseTrackerEntity, { nullable: true })
  @JoinColumn({ name: 'originalExpenseId' })
  originalExpense: ExpenseTrackerEntity;

  @ManyToOne(() => ExpenseTrackerEntity, { nullable: true })
  @JoinColumn({ name: 'parentExpenseId' })
  parentExpense: ExpenseTrackerEntity;
}
