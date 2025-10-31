import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { AssetMasterEntity } from 'src/modules/asset-masters/entities/asset-master.entity';
import { AssetFileEntity } from 'src/modules/asset-files/entities/asset-file.entity';

@Entity('assets_events')
@Index('idx_assets_events_from_user', ['fromUser'])
@Index('idx_assets_events_to_user', ['toUser'])
@Index('idx_assets_events_created_by', ['createdBy'])
export class AssetEventEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  assetMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  eventType: string;

  @Column({ type: 'uuid', nullable: true })
  fromUser?: string;

  @Column({ type: 'uuid', nullable: true })
  toUser?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Relations
  @ManyToOne(() => AssetMasterEntity, (asset) => asset.assetEvents)
  @JoinColumn({ name: 'assetMasterId' })
  assetMaster: AssetMasterEntity;

  @OneToMany(() => AssetFileEntity, (assetFile) => assetFile.assetEvent)
  assetFiles: AssetFileEntity[];
}
