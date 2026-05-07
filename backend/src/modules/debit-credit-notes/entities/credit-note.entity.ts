import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * Credit Note — PURCHASE side adjustment, standalone (§5.1.12)
 * No approval workflow per BRD §11 confirmed-3.
 */
@Entity('credit_notes')
@Index('IDX_CREDIT_NOTE_SITE', ['siteId'])
@Index('IDX_CREDIT_NOTE_VENDOR', ['vendorId'])
export class CreditNoteEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @Column({ type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => VendorEntity)
  @JoinColumn({ name: 'vendorId' })
  vendor: VendorEntity;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  noteDate: Date;

  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  // Auto-approved (no approval workflow)
  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;
}
