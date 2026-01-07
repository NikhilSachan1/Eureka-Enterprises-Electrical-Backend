import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { SalaryChangeLogEntity } from '../../salary-change-logs/entities/salary-change-log.entity';
import { IncrementType } from '../constants/salary-structure.constants';

@Entity('salary_structures')
export class SalaryStructureEntity extends BaseEntity {
  @Index('IDX_SALARY_STRUCTURE_USER_ID')
  @Column({ type: 'uuid' })
  userId: string;

  // ==================== Earnings ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  basic: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  hra: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  foodAllowance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  conveyanceAllowance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  medicalAllowance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  specialAllowance: number;

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

  // ==================== Calculated Fields ====================
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  netSalary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  ctc: number;

  // ==================== Effective Dates ====================
  @Index('IDX_SALARY_STRUCTURE_EFFECTIVE_FROM')
  @Column({ type: 'date' })
  effectiveFrom: Date;

  @Column({ type: 'date', nullable: true })
  effectiveTo: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ==================== Increment Tracking ====================
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  incrementPercentage: number;

  @Column({ type: 'varchar', nullable: false, default: IncrementType.INITIAL })
  incrementType: string;

  @Column({ type: 'uuid', nullable: true })
  previousStructureId: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // ==================== Relations ====================
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => SalaryStructureEntity, { nullable: true })
  @JoinColumn({ name: 'previousStructureId' })
  previousStructure: SalaryStructureEntity;

  @OneToMany(() => SalaryChangeLogEntity, (log) => log.salaryStructure)
  changeLogs: SalaryChangeLogEntity[];

  // ==================== Auto-calculate before save ====================
  @BeforeInsert()
  @BeforeUpdate()
  calculateTotals() {
    // Calculate Gross Salary (sum of all earnings)
    this.grossSalary =
      Number(this.basic || 0) +
      Number(this.hra || 0) +
      Number(this.conveyanceAllowance || 0) +
      Number(this.medicalAllowance || 0) +
      Number(this.specialAllowance || 0);

    // Calculate Total Deductions
    this.totalDeductions =
      Number(this.employeePf || 0) +
      Number(this.tds || 0) +
      Number(this.esic || 0) +
      Number(this.professionalTax || 0);

    // Calculate Net Salary
    this.netSalary = this.grossSalary - this.totalDeductions;

    // Calculate CTC (Gross + Employer contributions)
    this.ctc = this.grossSalary + Number(this.employerPf || 0);
  }
}
