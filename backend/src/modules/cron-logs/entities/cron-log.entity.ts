import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { CronJobStatus, CronJobType, CronTriggerType } from '../constants/cron-log.constants';

@Entity('cron_logs')
export class CronLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  jobName: string;

  @Column({ type: 'varchar', length: 50 })
  jobType: CronJobType;

  @Column({ type: 'varchar', length: 20, default: CronJobStatus.RUNNING })
  status: CronJobStatus;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  durationMs: number;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  errorStack: string;

  @Column({ type: 'varchar', length: 20, default: CronTriggerType.SYSTEM })
  triggeredBy: CronTriggerType;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  createdByUser: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
