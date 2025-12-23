import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { VehicleServiceFileEntity } from 'src/modules/vehicle-service-files/entities/vehicle-service-file.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

@Entity('vehicle_services')
@Index('IDX_VEHICLE_SERVICES_VEHICLE_MASTER', ['vehicleMasterId'])
@Index('IDX_VEHICLE_SERVICES_SERVICE_DATE', ['serviceDate'])
@Index('IDX_VEHICLE_SERVICES_SERVICE_TYPE', ['serviceType'])
@Index('IDX_VEHICLE_SERVICES_STATUS', ['serviceStatus'])
@Index('IDX_VEHICLE_SERVICES_ODOMETER', ['odometerReading'])
export class VehicleServiceEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleMasterId: string;

  @Column({ type: 'date', nullable: false })
  serviceDate: Date;

  @Column({ type: 'integer', nullable: false })
  odometerReading: number;

  @Column({ type: 'varchar', length: 50, nullable: false })
  serviceType: string;

  @Column({ type: 'text', nullable: true })
  serviceDetails: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  serviceCenterName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  serviceCost: number;

  @Column({ type: 'varchar', length: 50, nullable: false, default: 'PENDING' })
  serviceStatus: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  resetsServiceInterval: boolean;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Relations
  @ManyToOne(() => VehicleMasterEntity)
  @JoinColumn({ name: 'vehicleMasterId' })
  vehicleMaster: VehicleMasterEntity;

  @OneToMany(() => VehicleServiceFileEntity, (file) => file.vehicleService)
  serviceFiles: VehicleServiceFileEntity[];
}
