import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FnfStatus, ClearanceStatus } from '../constants/fnf.constants';

@Entity('fnf_settlements')
@Index('IDX_FNF_USER_ID', ['userId'])
@Index('IDX_FNF_STATUS', ['status'])
@Index('IDX_FNF_EXIT_DATE', ['exitDate'])
export class FnfEntity extends BaseEntity {
  // ==================== Exit Details ====================
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  exitDate: Date;

  @Column({ type: 'varchar', length: 50 })
  exitReason: string;

  @Column({ type: 'date' })
  lastWorkingDate: Date;

  // ==================== Salary Calculation ====================
  @Column({ type: 'int', default: 0 })
  daysWorked: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  dailySalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  finalSalary: number;

  @Column({ type: 'jsonb', nullable: true })
  salaryBreakdown: Record<string, any>;

  // ==================== Leave Encashment ====================
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  encashableLeaves: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  leaveEncashmentAmount: number;

  // ==================== Gratuity ====================
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  serviceYears: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gratuityAmount: number;

  // ==================== Deductions ====================
  @Column({ type: 'int', default: 0 })
  noticePeriodDays: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  noticePeriodRecovery: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherDeductions: number;

  @Column({ type: 'text', nullable: true })
  deductionRemarks: string;

  // ==================== Expense Settlement ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  pendingExpenseReimbursement: number; // Company owes employee (approved debits not yet paid)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unsettledExpenseCredit: number; // Employee owes company (credits given but not settled)

  // ==================== Fuel Expense Settlement ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  pendingFuelReimbursement: number; // Company owes employee (approved fuel debits not yet paid)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unsettledFuelCredit: number; // Employee owes company (fuel credits given but not settled)

  // ==================== Additions ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  pendingReimbursements: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherAdditions: number;

  @Column({ type: 'text', nullable: true })
  additionRemarks: string;

  // ==================== Clearance Status ====================
  @Column({ type: 'varchar', length: 20, default: ClearanceStatus.PENDING })
  assetsClearanceStatus: string;

  @Column({ type: 'varchar', length: 20, default: ClearanceStatus.PENDING })
  vehiclesClearanceStatus: string;

  @Column({ type: 'varchar', length: 20, default: ClearanceStatus.PENDING })
  cardsClearanceStatus: string;

  @Column({ type: 'text', nullable: true })
  clearanceRemarks: string;

  // ==================== Totals ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEarnings: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netPayable: number;

  // ==================== Documents ====================
  @Column({ type: 'varchar', length: 255, nullable: true })
  relievingLetterKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  experienceLetterKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fnfStatementKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payslipKey: string;

  // ==================== Workflow ====================
  @Column({ type: 'varchar', length: 30, default: FnfStatus.INITIATED })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  calculatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  calculatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  completedBy: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // ==================== Relations ====================
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'calculatedBy' })
  calculatedByUser: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'approvedBy' })
  approvedByUser: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'completedBy' })
  completedByUser: UserEntity;
}
