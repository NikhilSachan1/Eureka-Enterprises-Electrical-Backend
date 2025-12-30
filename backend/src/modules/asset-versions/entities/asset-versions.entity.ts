import { AssetMasterEntity } from 'src/modules/asset-masters/entities/asset-master.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AssetFileEntity } from 'src/modules/asset-files/entities/asset-file.entity';

@Entity('asset_versions')
@Index('IDX_ASSET_VERSIONS_NAME', ['name'])
@Index('IDX_ASSET_VERSIONS_CATEGORY', ['category'])
@Index('IDX_ASSET_VERSIONS_STATUS', ['status'])
@Index('IDX_ASSET_VERSIONS_ASSET_TYPE', ['assetType'])
@Index('IDX_ASSET_VERSIONS_ASSIGNED_TO', ['assignedTo'])
@Index('IDX_ASSET_VERSIONS_CALIBRATION_END_DATE', ['calibrationEndDate'])
@Index('IDX_ASSET_VERSIONS_WARRANTY_END_DATE', ['warrantyEndDate'])
export class AssetVersionEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  assetMasterId: string;

  // Master Info
  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  model: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  assetType: string;

  // Calibration fields
  @Column({ type: 'varchar', length: 100, nullable: true })
  calibrationFrom: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  calibrationFrequency: string;

  @Column({ type: 'date', nullable: true })
  calibrationStartDate: Date;

  @Column({ type: 'date', nullable: true })
  calibrationEndDate: Date;

  // Purchase & Warranty fields
  @Column({ type: 'date', nullable: true })
  purchaseDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendorName: string;

  @Column({ type: 'date', nullable: true })
  warrantyStartDate: Date;

  @Column({ type: 'date', nullable: true })
  warrantyEndDate: Date;

  // Status fields
  @Column({ type: 'varchar', length: 50, nullable: false, default: 'AVAILABLE' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  additionalData: Record<string, any>;

  // Relations
  @ManyToOne(() => AssetMasterEntity, (assetMaster) => assetMaster.assetVersions)
  @JoinColumn({ name: 'assetMasterId' })
  assetMaster: AssetMasterEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assignedTo' })
  assignedToUser: UserEntity;

  @OneToMany(() => AssetFileEntity, (assetFile) => assetFile.assetVersion)
  assetFiles: AssetFileEntity[];
}
