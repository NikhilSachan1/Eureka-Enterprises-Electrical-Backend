import { Entity, Column, Index, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { BookPaymentEntity } from 'src/modules/book-payments/entities/book-payment.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * Bank Transfer — both SALE and PURCHASE sides (§5.1.8)
 * 
 * SALE: links directly to invoice (invoiceId set, bookPaymentId null)
 *       Σ transferAmount per invoice ≤ invoice.totalAmount
 * 
 * PURCHASE: links to book payment (bookPaymentId set, invoiceId null)
 *           1:1 with book payment, transferAmount = bookPayment.paymentTotalAmount
 *           Auto-generates a payment advice on creation
 */
@Entity('bank_transfers')
@Index('IDX_BANK_TRANSFER_PARTY_TYPE', ['partyType'])
@Index('IDX_BANK_TRANSFER_INVOICE', ['invoiceId'])
@Index('IDX_BANK_TRANSFER_BOOK_PAYMENT', ['bookPaymentId'])
@Index('IDX_BANK_TRANSFER_SITE', ['siteId'])
@Index('IDX_BANK_TRANSFER_UTR', ['utrNumber'])
@Index('IDX_BANK_TRANSFER_FINANCIAL_YEAR', ['financialYear'])
export class BankTransferEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  partyType: string; // SALE | PURCHASE

  // For SALE side: direct link to invoice (nullable)
  @Column({ type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => SiteInvoiceEntity, { nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity | null;

  // For PURCHASE side: link to book payment (nullable, unique — 1:1)
  @Column({ type: 'uuid', nullable: true })
  bookPaymentId: string | null;

  @OneToOne(() => BookPaymentEntity, { nullable: true })
  @JoinColumn({ name: 'bookPaymentId' })
  bookPayment: BookPaymentEntity | null;

  // Denormalized fields for fast queries
  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

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

  // Denormalized pointer to PO for rollup maintenance
  @Column({ type: 'uuid' })
  poId: string;

  @Column({ type: 'varchar', length: 100 })
  utrNumber: string;

  @Column({ type: 'date' })
  transferDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  transferAmount: number;

  // Financial year for partitioning (e.g., "2526" for FY 2025-26)
  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  // Proof attachment (optional)
  @Column({ type: 'varchar', length: 500, nullable: true })
  proofFileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proofFileName: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  // Auto-approved (BRD §5.1.8)
  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date | null;
}
