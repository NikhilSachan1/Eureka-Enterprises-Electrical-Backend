import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('expenses')
@Index('idx_expenses_userId', ['userId'])
@Index('idx_expenses_approvalBy', ['approvalBy'])
@Index('idx_expenses_approvalStatus', ['approvalStatus'])
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

  @Column({ type: 'varchar', nullable: false })
  approvalReason: string;

  @Column({ type: 'varchar', nullable: false })
  transactionType: string;

  @Column({ type: 'varchar', nullable: false })
  paymentMode: string;

  @Column({ type: 'text', nullable: false })
  entrySourceType: string;

  @Column({ type: 'text', nullable: false })
  expenseEntryType: string;

  // Relationships
  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity;
}
