import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * Default line items that pre-fill a new PO on the FE. Not editable via API for now (seeded via
 * migration; team replaces the placeholder with real defaults later).
 */
@Entity('po_default_items')
export class PoDefaultItemEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  hsnCode: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  make: string | null;

  // Pre-fills the unit on the line item so the user does not retype it for a standard item.
  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
