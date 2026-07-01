import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PaymentSheetItemEntity } from './payment-sheet-item.entity';

/**
 * Per-line, per-review-stage verification. A row's presence means the item is verified for
 * that stage (e.g. HR_REVIEW / ADMIN_REVIEW). Rows are HARD-deleted when cleared, so the
 * unique (itemId, stage) constraint holds. See docs/payment-sheet-spec.md §14.
 */
@Entity('payment_sheet_item_verifications')
@Unique('UQ_PS_ITEM_VERIFICATION', ['itemId', 'stage'])
@Index('IDX_PS_ITEM_VERIFICATION_ITEM', ['itemId'])
@Index('IDX_PS_ITEM_VERIFICATION_SHEET', ['paymentSheetId'])
export class PaymentSheetItemVerificationEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  itemId: string;

  @ManyToOne(() => PaymentSheetItemEntity)
  @JoinColumn({ name: 'itemId' })
  item: PaymentSheetItemEntity;

  @Column({ type: 'uuid' })
  paymentSheetId: string;

  @Column({ type: 'varchar', length: 30 })
  stage: string;

  @Column({ type: 'uuid' })
  verifiedBy: string;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  verifiedAt: Date;
}
