import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { AssetMasterEntity } from 'src/modules/asset-masters/entities/asset-master.entity';
import { AssetEventEntity } from 'src/modules/asset-events/entities/asset-event.entity';

@Entity('assets_files')
@Index('idx_assets_files_asset_events_id', ['assetEventsId'])
export class AssetFileEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  assetMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  fileType: string;

  @Column({ type: 'varchar', nullable: false })
  fileKey: string;

  @Column({ type: 'uuid', nullable: true })
  assetEventsId: string;

  // Relations
  @ManyToOne(() => AssetMasterEntity, (asset) => asset.assetFiles)
  @JoinColumn({ name: 'assetMasterId' })
  assetMaster: AssetMasterEntity;

  @ManyToOne(() => AssetEventEntity, (assetEvent) => assetEvent.assetFiles)
  @JoinColumn({ name: 'assetEventsId' })
  assetEvent?: AssetEventEntity;
}
