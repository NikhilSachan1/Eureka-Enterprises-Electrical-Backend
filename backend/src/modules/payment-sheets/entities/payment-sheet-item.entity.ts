import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PaymentSheetItemStatus } from '../constants/payment-sheet.constants';
import { PaymentSheetEntity } from './payment-sheet.entity';
import { PaymentSheetItemBookPaymentEntity } from './payment-sheet-item-book-payment.entity';
import { CompanyBankAccountEntity } from 'src/modules/company-bank-accounts/entities/company-bank-account.entity';

export interface BankSnapshot {
  accountHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
}

/**
 * One settlement line: a single (beneficiary × source). A user with both expense
 * and fuel pending produces two items (D2).
 */
@Entity('payment_sheet_items')
@Index('IDX_PAYMENT_SHEET_ITEM_SHEET', ['paymentSheetId'])
@Index('IDX_PAYMENT_SHEET_ITEM_USER', ['userId'])
@Index('IDX_PAYMENT_SHEET_ITEM_VENDOR', ['vendorId'])
@Index('IDX_PAYMENT_SHEET_ITEM_STATUS', ['itemStatus'])
export class PaymentSheetItemEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  paymentSheetId: string;

  @ManyToOne(() => PaymentSheetEntity, (sheet) => sheet.items)
  @JoinColumn({ name: 'paymentSheetId' })
  paymentSheet: PaymentSheetEntity;

  @Column({ type: 'varchar', length: 10 })
  beneficiaryType: string; // BeneficiaryType

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @Column({ type: 'varchar', length: 20 })
  sourceType: string; // PaymentSourceType

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  pendingSnapshot: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  requestedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  currentAmount: number;

  @Column({ type: 'jsonb', nullable: true })
  bankSnapshot: BankSnapshot | null;

  @Column({ type: 'varchar', length: 20, default: PaymentSheetItemStatus.PENDING })
  itemStatus: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  paidAmount: number | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  // Accountant who marked this item PAID.
  @Column({ type: 'uuid', nullable: true })
  paidBy: string | null;

  // UTR / bank_transfer id(s) / credit-txn id recorded on PAID.
  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentRef: string | null;

  // Which of the org's own bank accounts this item was paid from (set at pay-time).
  @Column({ type: 'uuid', nullable: true })
  paidFromAccountId: string | null;

  @ManyToOne(() => CompanyBankAccountEntity, { nullable: true })
  @JoinColumn({ name: 'paidFromAccountId' })
  paidFromAccount: CompanyBankAccountEntity | null;

  @Column({ type: 'text', nullable: true })
  holdReason: string | null;

  // Accountant who placed HOLD; only they may release (D6).
  @Column({ type: 'uuid', nullable: true })
  heldBy: string | null;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  // Who rejected this line, when, and at which stage (HR_REVIEW / ADMIN_REVIEW / PROCESSING).
  // Reject is one-time & terminal, so a single set of columns suffices.
  @Column({ type: 'uuid', nullable: true })
  rejectedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rejectStage: string | null;

  @OneToMany(() => PaymentSheetItemBookPaymentEntity, (alloc) => alloc.item)
  bookPaymentAllocations: PaymentSheetItemBookPaymentEntity[];
}
