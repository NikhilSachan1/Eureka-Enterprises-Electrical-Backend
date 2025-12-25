import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SalaryStructureEntity } from '../../salary-structures/entities/salary-structure.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

@Entity('salary_change_logs')
export class SalaryChangeLogEntity extends BaseEntity {
  @Index('IDX_SALARY_CHANGE_LOG_STRUCTURE_ID')
  @Column({ type: 'uuid' })
  salaryStructureId: string;

  @Column({ type: 'varchar', nullable: false })
  changeType: string;

  @Column({ type: 'jsonb', nullable: true })
  previousValues: Record<string, any>;

  @Column({ type: 'jsonb' })
  newValues: Record<string, any>;

  @Column({ type: 'uuid' })
  changedBy: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changedAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  // ==================== Relations ====================
  @ManyToOne(() => SalaryStructureEntity, (structure) => structure.changeLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'salaryStructureId' })
  salaryStructure: SalaryStructureEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'changedBy' })
  changedByUser: UserEntity;
}
