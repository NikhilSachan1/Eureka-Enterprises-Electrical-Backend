import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { JmcEntity } from 'src/modules/jmc/entities/jmc.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

@Entity('site_reports')
@Index('IDX_REPORT_JMC', ['jmcId'], { unique: true })
@Index('IDX_REPORT_SITE', ['siteId'])
@Index('IDX_REPORT_PARTY_TYPE', ['partyType'])
export class SiteReportEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  jmcId: string;

  @ManyToOne(() => JmcEntity)
  @JoinColumn({ name: 'jmcId' })
  jmc: JmcEntity;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @Column({ type: 'varchar', length: 20 })
  partyType: string;

  @Column({ type: 'uuid', nullable: true })
  contractorId: string | null;

  @ManyToOne(() => ContractorEntity, { nullable: true })
  @JoinColumn({ name: 'contractorId' })
  contractor: ContractorEntity | null;

  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @ManyToOne(() => VendorEntity, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reportNumber: string | null;

  @Column({ type: 'date' })
  reportDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Auto-approved per BRD §4.3 — written at creation time for uniformity
  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity | null;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date | null;
}
