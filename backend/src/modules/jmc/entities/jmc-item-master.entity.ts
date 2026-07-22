import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

/**
 * Global item-name suggestion master (name only). Grows as JMC line items are saved anywhere
 * in the system and feeds the typeahead. Case-insensitive uniqueness is enforced by the
 * `UQ_JMC_ITEM_MASTERS_NAME_LOWER` unique index (LOWER(name)) created in the migration.
 */
@Entity('jmc_item_masters')
export class JmcItemMasterEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;
}
