import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PaymentSheetStatus } from '../constants/payment-sheet.constants';
import { PaymentSheetItemEntity } from './payment-sheet-item.entity';

/**
 * Payment Sheet header — a batch of beneficiary settlements moving through a
 * configurable approval chain. See docs/payment-sheet-spec.md.
 */
@Entity('payment_sheets')
@Index('IDX_PAYMENT_SHEET_STATUS', ['status'])
@Index('IDX_PAYMENT_SHEET_STAGE', ['currentStage'])
@Index('IDX_PAYMENT_SHEET_FY', ['financialYear'])
export class PaymentSheetEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  sheetNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'varchar', length: 10 })
  financialYear: string;

  @Column({ type: 'varchar', length: 20, default: PaymentSheetStatus.DRAFT })
  status: string;

  // Current stage key from the configured approval chain; null when DRAFT/terminal.
  @Column({ type: 'varchar', length: 30, nullable: true })
  currentStage: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRequestedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCurrentAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPaidAmount: number;

  // S3 key of the rendered sheet PDF (async generated).
  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfKey: string | null;

  @OneToMany(() => PaymentSheetItemEntity, (item) => item.paymentSheet)
  items: PaymentSheetItemEntity[];
}
