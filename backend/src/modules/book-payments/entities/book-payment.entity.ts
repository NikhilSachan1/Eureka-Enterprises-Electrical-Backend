import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';
import { AdvancePaymentEntity } from 'src/modules/advance-payments/entities/advance-payment.entity';
import { BookPaymentSourceType } from '../constants/book-payment.constants';

/**
 * Book Payment — PURCHASE side only (§5.1.7)
 * Represents a payment booking before the actual bank transfer, against either an approved
 * **invoice** (the original flow) or an approved **advance payment** (pre-invoice money).
 *
 * Exactly one source is set, matching `sourceType`. That is enforced in the database by
 * CHK_BOOK_PAYMENT_SOURCE rather than left to application code.
 */
@Entity('book_payments')
@Index('IDX_BOOK_PAYMENT_INVOICE', ['invoiceId'])
@Index('IDX_BOOK_PAYMENT_ADVANCE', ['advancePaymentId'])
@Index('IDX_BOOK_PAYMENT_SITE', ['siteId'])
@Index('IDX_BOOK_PAYMENT_VENDOR', ['vendorId'])
@Index('IDX_BOOK_PAYMENT_PO', ['poId'])
export class BookPaymentEntity extends BaseEntity {
  /**
   * Which document this booking is against. Defaults to INVOICE so every pre-existing row — all
   * of which were necessarily invoice-backed — reads correctly without a backfill.
   */
  @Column({ type: 'varchar', length: 20, default: BookPaymentSourceType.INVOICE })
  sourceType: string;

  /** Set when sourceType = INVOICE. Null for advance-backed bookings. */
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => SiteInvoiceEntity, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity | null;

  /** Set when sourceType = ADVANCE. Null for invoice-backed bookings. */
  @Column({ type: 'uuid', nullable: true })
  advancePaymentId: string | null;

  @ManyToOne(() => AdvancePaymentEntity, { nullable: true })
  @JoinColumn({ name: 'advancePaymentId' })
  advancePayment: AdvancePaymentEntity | null;

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

  // Lock / unlock — auto-locked on approval (created auto-approved+locked); JMC-style unlock workflow
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
}
