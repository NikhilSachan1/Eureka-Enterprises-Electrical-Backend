import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { VehicleLogStatus } from '../constants/vehicle-logs.constants';

@Entity('vehicle_logs')
@Index('IDX_VEHICLE_LOGS_VEHICLE_ID', ['vehicleId'])
@Index('IDX_VEHICLE_LOGS_DRIVER_ID', ['driverId'])
@Index('IDX_VEHICLE_LOGS_SITE_ID', ['siteId'])
@Index('IDX_VEHICLE_LOGS_LOG_DATE', ['logDate'])
@Index('IDX_VEHICLE_LOGS_STATUS', ['status'])
@Index('IDX_VEHICLE_LOGS_ANOMALY', ['anomalyDetected'])
export class VehicleLogEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  vehicleId: string;

  @Column({ type: 'uuid' })
  driverId: string;

  @Column({ type: 'uuid', nullable: true })
  siteId: string;

  @Column({ type: 'date' })
  logDate: Date;

  // Status: STARTED (trip begun) or COMPLETED (trip ended)
  @Column({ type: 'varchar', length: 20, default: VehicleLogStatus.STARTED })
  status: string;

  // Start entry (required when starting)
  @Column({ type: 'integer' })
  startOdometerReading: number;

  @Column({ type: 'time', nullable: true })
  startTime: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  startLocation: string;

  // End entry (nullable until trip completed)
  @Column({ type: 'integer', nullable: true })
  endOdometerReading: number;

  @Column({ type: 'time', nullable: true })
  endTime: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endLocation: string;

  // Calculated fields (set when completed)
  @Column({ type: 'integer', nullable: true })
  totalKmTraveled: number;

  @Column({ type: 'boolean', default: false })
  anomalyDetected: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  anomalyReason: string;

  // Additional fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string;

  @Column({ type: 'text', nullable: true })
  driverRemarks: string;

  // Admin flag for odometer reset (after service/repair)
  @Column({ type: 'boolean', default: false })
  odometerResetFlag: boolean;

  // Relations using string-based references to avoid circular imports
  @ManyToOne('VehicleMasterEntity', { nullable: false })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: any;

  @ManyToOne('UserEntity', { nullable: false })
  @JoinColumn({ name: 'driverId' })
  driver: any;

  @ManyToOne('SiteEntity', { nullable: true })
  @JoinColumn({ name: 'siteId' })
  site: any;

  @OneToMany('VehicleLogFileEntity', 'vehicleLog')
  files: any[];
}
