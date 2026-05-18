import { Entity, Column, Index, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { BankTransferEntity } from 'src/modules/bank-transfers/entities/bank-transfer.entity';
import { SiteEntity } from 'src/modules/sites/entities/site.entity';
import { VendorEntity } from 'src/modules/vendors/entities/vendor.entity';
import { FinancialApprovalStatus } from 'src/modules/common/financials/financial.constants';

/**
 * Payment Advice — PURCHASE side only, auto-generated (§5.1.9)
 * Created when a bank transfer is created for a book payment.
 * Reference number format: EE/TA/{FY}/{seq} (e.g., EE/TA/2526/001)
 */
@Entity('payment_advices')
@Index('IDX_PAYMENT_ADVICE_BANK_TRANSFER', ['bankTransferId'], { unique: true })
@Index('IDX_PAYMENT_ADVICE_SITE', ['siteId'])
@Index('IDX_PAYMENT_ADVICE_VENDOR', ['vendorId'])
@Index('IDX_PAYMENT_ADVICE_FINANCIAL_YEAR', ['financialYear'])
@Index('IDX_PAYMENT_ADVICE_REFERENCE', ['referenceNumber'], { unique: true })
export class PaymentAdviceEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  bankTransferId: string;

  @OneToOne(() => BankTransferEntity, (bt) => bt.paymentAdvice)
  @JoinColumn({ name: 'bankTransferId' })
  bankTransfer: BankTransferEntity;

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

  // Format: EE/TA/{FY}/{seq} — globally unique
  @Column({ type: 'varchar', length: 50 })
  referenceNumber: string;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  @Column({ type: 'integer' })
  sequenceNumber: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  generatedAt: Date;

  // PDF S3 key once rendered (template TBD per BRD §12.3)
  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfKey: string | null;

  @Column({ type: 'varchar', length: 20, default: FinancialApprovalStatus.APPROVED })
  approvalStatus: string;
}
