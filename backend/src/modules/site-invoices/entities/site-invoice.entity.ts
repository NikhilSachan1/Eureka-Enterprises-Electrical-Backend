import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { JmcEntity } from 'src/modules/jmc/entities/jmc.entity';
import { SiteReportEntity } from 'src/modules/site-reports/entities/site-report.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

@Entity('site_invoices')
@Index('IDX_INVOICE_JMC', ['jmcId'], { unique: true })
@Index('IDX_INVOICE_REPORT', ['reportId'])
@Index('IDX_INVOICE_SITE', ['siteId'])
@Index('IDX_INVOICE_PARTY_TYPE', ['partyType'])
@Index('IDX_INVOICE_APPROVAL_STATUS', ['approvalStatus'])
export class SiteInvoiceEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  jmcId: string;

  @ManyToOne(() => JmcEntity)
  @JoinColumn({ name: 'jmcId' })
  jmc: JmcEntity;

  // Nullable on Sale side per BRD §12 pending; required on Purchase side (validated in service)
  @Column({ type: 'uuid', nullable: true })
  reportId: string | null;

  @ManyToOne(() => SiteReportEntity, { nullable: true })
  @JoinColumn({ name: 'reportId' })
  report: SiteReportEntity | null;

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

  // Pointer back to parent PO (denormalized — JMC.poId, immutable for invoice)
  @Column({ type: 'uuid' })
  poId: string;

  @Column({ type: 'varchar', length: 100 })
  invoiceNumber: string;

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  gstPercentage: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  tdsAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tdsPercentage: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.PENDING })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity | null;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date | null;

  @Column({ type: 'text', nullable: true })
  approvalReason: string | null;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  unlockRequestedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  unlockRequestedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'unlockRequestedBy' })
  unlockRequestedByUser: UserEntity | null;

  @Column({ type: 'text', nullable: true })
  unlockReason: string | null;

  // GST hold flag — true = GST withheld (register entry stays pending); false = auto-verified on approval
  @Column({ type: 'boolean', default: false })
  isGstHold: boolean;

  // Denormalized rollups for fast invoice-level reads
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  bookedTotal: number; // sum of book_payments (purchase only)

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidTotal: number; // sum of bank_transfers
}
