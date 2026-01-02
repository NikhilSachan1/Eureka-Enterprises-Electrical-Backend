import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { SalaryStructureEntity } from '../../salary-structures/entities/salary-structure.entity';
import { PayrollStatus } from '../constants/payroll.constants';

@Entity('payroll')
@Index('IDX_PAYROLL_USER_MONTH_YEAR', ['userId', 'month', 'year'], { unique: true })
export class PayrollEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  salaryStructureId: string;

  @Index('IDX_PAYROLL_MONTH_YEAR')
  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  // ==================== Attendance Summary ====================
  @Column({ type: 'int', default: 0 })
  totalDays: number;

  @Column({ type: 'int', default: 0 })
  workingDays: number;

  @Column({ type: 'int', default: 0 })
  presentDays: number;

  @Column({ type: 'int', default: 0 })
  absentDays: number;

  @Column({ type: 'int', default: 0 })
  paidLeaveDays: number;

  @Column({ type: 'int', default: 0 })
  unpaidLeaveDays: number;

  @Column({ type: 'int', default: 0 })
  holidays: number;

  @Column({ type: 'int', default: 0 })
  holidaysWorked: number;

  @Column({ type: 'int', default: 0 })
  weekoffs: number;

  // ==================== Prorated Earnings ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  basicProrated: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  hraProrated: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  foodAllowanceProrated: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  conveyanceAllowanceProrated: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  medicalAllowanceProrated: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  specialAllowanceProrated: number;

  // ==================== Deductions ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  employeePf: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  employerPf: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  tds: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  esic: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  professionalTax: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  lopDeduction: number;

  // ==================== Bonus ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalBonus: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  holidayBonus: number;

  @Column({ type: 'int', default: 0 })
  holidayLeavesCredited: number;

  @Column({ type: 'jsonb', nullable: true })
  bonusDetails: { bonusId: string; type: string; amount: number }[];

  // ==================== Leave Details ====================
  @Column({ type: 'jsonb', nullable: true })
  leaveDetails: { leaveCategory: string; leaveType: string; count: number }[];

  @Column({ type: 'decimal', precision: 4, scale: 1, default: 0 })
  halfDays: number;

  // ==================== Totals ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossEarnings: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netPayable: number;

  // ==================== Status & Workflow ====================
  @Column({ type: 'varchar', nullable: false, default: PayrollStatus.DRAFT })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  generatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // ==================== Relations ====================
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => SalaryStructureEntity)
  @JoinColumn({ name: 'salaryStructureId' })
  salaryStructure: SalaryStructureEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'approvedBy' })
  approver: UserEntity;
}
