import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * Book Payment — PURCHASE side only (§5.1.7)
 * Represents a payment booking against an approved invoice before the actual bank transfer.
 */
@Entity('book_payments')
@Index('IDX_BOOK_PAYMENT_INVOICE', ['invoiceId'])
@Index('IDX_BOOK_PAYMENT_SITE', ['siteId'])
@Index('IDX_BOOK_PAYMENT_VENDOR', ['vendorId'])
@Index('IDX_BOOK_PAYMENT_PO', ['poId'])
export class BookPaymentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SiteInvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity;

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

  // Denormalized pointer to PO for rollup maintenance
  @Column({ type: 'uuid' })
  poId: string;

  @Column({ type: 'date' })
  bookingDate: Date;

  // Reference amounts from invoice — informational
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  gstPercentage: number | null;

  // Actual cash amount to the vendor = taxableAmount (TDS deducted at invoice level; GST excluded — tracked in GST register)
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  paymentTotalAmount: number;

  // GST hold — which GSTR compliance return is pending; null = no GST hold
  @Column({ type: 'varchar', length: 10, nullable: true })
  gstHoldType: '1B' | '3B' | null;

  // GST amount being withheld (informational; equals gstAmount when gstHoldType is set)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  gstHoldAmount: number;

  // Net payment hold amount (non-GST operational reasons; transferAmount = paymentTotalAmount − paymentHoldAmount)
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  paymentHoldAmount: number;

  @Column({ type: 'text', nullable: true })
  paymentHoldReason: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  // Auto-approved (BRD §5.1.7)
  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity | null;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date | null;

  // Flag if a bank transfer has been created for this book payment (1:1)
  @Column({ type: 'boolean', default: false })
  hasTransfer: boolean;
}
