import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * GST Payment — PURCHASE side only, monthly release (§5.1.14)
 * Full monthly GST released in one transaction; once released, no revert.
 */
@Entity('gst_payments')
@Index('IDX_GST_PAYMENT_SITE', ['siteId'])
@Index('IDX_GST_PAYMENT_VENDOR', ['vendorId'])
@Index('IDX_GST_PAYMENT_MONTH', ['paymentMonth'])
export class GstPaymentEntity extends BaseEntity {
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

  // Format: YYYY-MM
  @Column({ type: 'char', length: 7 })
  paymentMonth: string;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  // Sum of GST on verified entries for the month
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  netAmount: number;

  @Column({ type: 'varchar', length: 100 })
  utrNumber: string;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  // Auto-generated GST payment advice reference (separate sequence from Payment Advice)
  @Column({ type: 'varchar', length: 50 })
  paymentAdviceReferenceNumber: string;

  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;
}
