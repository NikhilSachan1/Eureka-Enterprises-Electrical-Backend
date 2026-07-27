import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { PurchaseOrderEntity } from './purchase-order.entity';

/**
 * A line item of a system-generated PO (materials being purchased). `amount` = quantity × rate.
 * `quantity` is numeric so a future material-consumption feature can compute remaining stock.
 */
@Entity('po_items')
@Index('IDX_PO_ITEMS_PO_ID', ['poId'])
export class PoItemEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  poId: string;

  @ManyToOne(() => PurchaseOrderEntity, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poId' })
  po: PurchaseOrderEntity;

  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  make: string | null;

  @Column({ type: 'numeric', precision: 15, scale: 3, default: 0 })
  quantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  rate: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
