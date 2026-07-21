import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { JmcEntity } from './jmc.entity';

/**
 * A single line item of a system-generated JMC. Unit and quantity are free text
 * (per requirement). `sortOrder` preserves the row order shown in the PDF/table.
 */
@Entity('jmc_items')
@Index('IDX_JMC_ITEMS_JMC_ID', ['jmcId'])
export class JmcItemEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  jmcId: string;

  @ManyToOne(() => JmcEntity, (jmc) => jmc.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jmcId' })
  jmc: JmcEntity;

  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'varchar', length: 100 })
  unit: string;

  @Column({ type: 'varchar', length: 100 })
  quantity: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}
