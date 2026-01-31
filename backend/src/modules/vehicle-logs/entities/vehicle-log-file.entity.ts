import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('vehicle_log_files')
@Index('IDX_VEHICLE_LOG_FILES_LOG_ID', ['vehicleLogId'])
@Index('IDX_VEHICLE_LOG_FILES_TYPE', ['fileType'])
export class VehicleLogFileEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  vehicleLogId: string;

  @Column({ type: 'varchar', length: 50 })
  fileType: string;

  @Column({ type: 'varchar', length: 500 })
  fileKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  // Relation using string-based reference to avoid circular imports
  @ManyToOne('VehicleLogEntity', 'files')
  @JoinColumn({ name: 'vehicleLogId' })
  vehicleLog: any;
}
