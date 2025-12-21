import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AssetFileEntity } from 'src/modules/asset-files/entities/asset-file.entity';
import { AssetEventEntity } from 'src/modules/asset-events/entities/asset-event.entity';
import { AssetVersionEntity } from 'src/modules/asset-versions/entities/asset-versions.entity';

@Entity('asset_masters')
export class AssetMasterEntity extends BaseEntity {
  @Index('IDX_ASSET_MASTERS_ASSET_ID_UNIQUE', { unique: true })
  @Column({ type: 'varchar', nullable: false })
  assetId: string;

  @OneToMany(() => AssetVersionEntity, (assetVersions) => assetVersions.assetMaster)
  assetVersions: AssetVersionEntity[];

  @OneToMany(() => AssetEventEntity, (assetEvents) => assetEvents.assetMaster)
  assetEvents: AssetEventEntity[];

  @OneToMany(() => AssetFileEntity, (assetFiles) => assetFiles.assetMaster)
  assetFiles: AssetFileEntity[];
}
