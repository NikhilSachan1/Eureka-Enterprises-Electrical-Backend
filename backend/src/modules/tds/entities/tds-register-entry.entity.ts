import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { SiteInvoiceEntity } from 'src/modules/site-invoices/entities/site-invoice.entity';
import { BookPaymentEntity } from 'src/modules/book-payments/entities/book-payment.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
// Forward ref to avoid circular
import type { BankTransferEntity } from 'src/modules/bank-transfers/entities/bank-transfer.entity';
import { ContractorEntity } from 'src/modules/contractors/entities/contractor.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';

/**
 * TDS Register Entry — projected from book payments (PURCHASE) or invoice approval (SALE).
 * Applies to BOTH SALE and PURCHASE sides.
 */
@Entity('tds_register_entries')
@Index('IDX_TDS_REG_INVOICE', ['invoiceId'])
@Index('IDX_TDS_REG_BOOK_PAYMENT', ['bookPaymentId', 'financialYear'], {
  unique: true,
  where: '"bookPaymentId" IS NOT NULL',
})
@Index('IDX_TDS_REG_BANK_TRANSFER', ['bankTransferId', 'financialYear'], {
  unique: true,
  where: '"bankTransferId" IS NOT NULL',
})
@Index('IDX_TDS_REG_SITE', ['siteId'])
@Index('IDX_TDS_REG_PARTY_TYPE', ['partyType'])
@Index('IDX_TDS_REG_MONTH', ['invoiceMonth'])
@Index('IDX_TDS_REG_FINANCIAL_YEAR', ['financialYear'])
export class TdsRegisterEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => SiteInvoiceEntity)
  @JoinColumn({ name: 'invoiceId' })
  invoice: SiteInvoiceEntity;

  @Column({ type: 'uuid', nullable: true })
  bookPaymentId: string | null;

  @ManyToOne(() => BookPaymentEntity, { nullable: true })
  @JoinColumn({ name: 'bookPaymentId' })
  bookPayment: BookPaymentEntity | null;

  @Column({ type: 'uuid', nullable: true })
  bankTransferId: string | null;

  @ManyToOne('BankTransferEntity', { nullable: true })
  @JoinColumn({ name: 'bankTransferId' })
  bankTransfer: BankTransferEntity | null;

  @Column({ type: 'uuid' })
  siteId: string;

  @ManyToOne(() => SiteEntity)
  @JoinColumn({ name: 'siteId' })
  site: SiteEntity;

  @Column({ type: 'varchar', length: 20 })
  partyType: string; // SALE | PURCHASE

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

  // Format: YYYY-MM
  @Column({ type: 'char', length: 7 })
  invoiceMonth: string;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  taxableAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  tdsAmount: number;

  // Verification
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'verifiedBy' })
  verifiedByUser: UserEntity | null;

  // Revert reason (set when verification is reverted)
  @Column({ type: 'text', nullable: true })
  revertReason: string | null;

  // Optional document attached during verification
  @Column({ type: 'varchar', length: 500, nullable: true })
  verifyFileKey: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verifyFileName: string | null;

  // Optional remarks during verification
  @Column({ type: 'text', nullable: true })
  verifyRemarks: string | null;

  // Set once entry is included in a TDS payment
  @Column({ type: 'uuid', nullable: true })
  tdsPaymentId: string | null;
}
