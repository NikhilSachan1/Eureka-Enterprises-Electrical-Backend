import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * Audit trail of every amount edit / add / remove / process action on an item,
 * with the acting stage and a reason.
 */
@Entity('payment_sheet_item_history')
@Index('IDX_PS_ITEM_HISTORY_ITEM', ['itemId'])
@Index('IDX_PS_ITEM_HISTORY_SHEET', ['paymentSheetId'])
export class PaymentSheetItemHistoryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'uuid' })
  paymentSheetId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  stage: string | null;

  @Column({ type: 'varchar', length: 20 })
  action: string; // ItemHistoryAction

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  previousAmount: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  newAmount: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
