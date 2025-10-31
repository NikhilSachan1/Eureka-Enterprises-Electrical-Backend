import { AssetMasterEntity } from 'src/modules/asset-masters/entities/asset-master.entity';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('asset_versions')
@Index('idx_assets_number', ['number'])
@Index('idx_assets_brand', ['brand'])
export class AssetVersionEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  number: string;

  @Column({ type: 'uuid', nullable: false })
  assetMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  brand: string;

  @Column({ type: 'varchar', nullable: false })
  model: string;

  @Column({ type: 'varchar', nullable: false })
  category: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  additionalData: Record<string, any>;

  @ManyToOne(() => AssetMasterEntity, (assetMaster) => assetMaster.assetVersions)
  @JoinColumn({ name: 'assetMasterId' })
  assetMaster: AssetMasterEntity;
}
