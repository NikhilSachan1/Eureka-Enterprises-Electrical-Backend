import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * Global PO item-name suggestion master (separate from JMC's). Grows as PO line items are saved;
 * feeds the PO item typeahead. Case-insensitive uniqueness via the
 * `UQ_PO_ITEM_MASTERS_NAME_LOWER` index (LOWER(name)) created in the migration.
 */
@Entity('po_item_masters')
export class PoItemMasterEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // The unit last saved for this item name, so the typeahead can pre-fill it. Advisory only — the
  // user can still change it per line.
  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;
}
