import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { DSR_DEFAULT_STATUS } from '../constants/dsr.constants';

@Entity('daily_status_reports')
@Unique('UQ_DSR_SITE_USER_DATE_ACTIVE', ['siteId', 'userId', 'reportDate', 'isActive'])
@Index('IDX_DSR_SITE', ['siteId'])
@Index('IDX_DSR_USER', ['userId'])
@Index('IDX_DSR_REPORT_DATE', ['reportDate'])
@Index('IDX_DSR_STATUS', ['status'])
@Index('IDX_DSR_IS_ACTIVE', ['isActive'])
@Index('IDX_DSR_ORIGINAL_ID', ['originalDsrId'])
export class DailyStatusReportEntity extends BaseEntity {
  // Site reference
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  // User reference
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  // Report date
  @Column({ type: 'date' })
  reportDate: Date;

  // Work types (array of work type values from config)
  @Column({ type: 'jsonb', nullable: true })
  workTypes: string[];

  // Work description (optional)
  @Column({ type: 'text', nullable: true })
  workDescription: string;

  // Hours worked (from shift config)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  hoursWorked: number;

  // Challenges (optional)
  @Column({ type: 'text', nullable: true })
  challenges: string;

  // Reporting engineer details (optional)
  @Column({ type: 'varchar', length: 255, nullable: true })
  reportingEngineerName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reportingEngineerContact: string;

  // Weather condition (optional) - config driven
  @Column({ type: 'varchar', length: 20, nullable: true })
  weatherCondition: string;

  // Manpower count (optional)
  @Column({ type: 'integer', nullable: true })
  manpowerCount: number;

  // Equipment used (array of assetVersionIds)
  @Column({ type: 'jsonb', nullable: true })
  equipmentUsed: string[];

  // Status - default APPROVED (auto-approval)
  @Column({ type: 'varchar', length: 20, default: DSR_DEFAULT_STATUS })
  status: string;

  // Approval details
  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvedBy' })
  approvedByUser: UserEntity;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  // Remarks (optional)
  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Versioning fields (like expense tracker)
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  originalDsrId: string;

  @Column({ type: 'uuid', nullable: true })
  parentDsrId: string;

  @Column({ type: 'integer', default: 1 })
  versionNumber: number;

  @Column({ type: 'text', nullable: true })
  editReason: string;

  // Relations
  @OneToMany('DsrFileEntity', 'dsr')
  files: any[];

  @OneToMany('DsrEditHistoryEntity', 'dsr')
  editHistory: any[];

  // Self-referencing relations for version history
  @ManyToOne(() => DailyStatusReportEntity, { nullable: true })
  @JoinColumn({ name: 'originalDsrId' })
  originalDsr: DailyStatusReportEntity;

  @ManyToOne(() => DailyStatusReportEntity, { nullable: true })
  @JoinColumn({ name: 'parentDsrId' })
  parentDsr: DailyStatusReportEntity;
}
