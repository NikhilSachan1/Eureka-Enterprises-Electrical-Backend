import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PaymentSheetItemEntity } from './payment-sheet-item.entity';

/**
 * Allocation of a vendor item to specific book payments. Because book-payment →
 * bank-transfer is 1:1 and exact, a vendor item's amount = Σ of its allocated book
 * payments; "decreasing" a vendor amount = dropping an allocation (D9).
 */
@Entity('payment_sheet_item_book_payments')
@Index('IDX_PS_ITEM_BP_ITEM', ['itemId'])
@Index('IDX_PS_ITEM_BP_BOOK_PAYMENT', ['bookPaymentId'])
export class PaymentSheetItemBookPaymentEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  itemId: string;

  @ManyToOne(() => PaymentSheetItemEntity, (item) => item.bookPaymentAllocations)
  @JoinColumn({ name: 'itemId' })
  item: PaymentSheetItemEntity;

  @Column({ type: 'uuid' })
  bookPaymentId: string;

  // Snapshot of the book payment's transferable amount at allocation time.
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  allocatedAmount: number;

  // bank_transfer id once this allocation is disbursed.
  @Column({ type: 'uuid', nullable: true })
  bankTransferId: string | null;
}
