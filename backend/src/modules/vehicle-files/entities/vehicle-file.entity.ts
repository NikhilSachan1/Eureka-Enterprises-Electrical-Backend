import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';

@Entity('vehicles_files')
@Index('idx_vehicles_files_vehicle_events_id', ['vehicleEventsId'])
export class VehicleFileEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  fileType: string;

  @Column({ type: 'varchar', nullable: false })
  fileKey: string;

  @Column({ type: 'uuid', nullable: true })
  vehicleEventsId: string;

  // Relations
  @ManyToOne(() => VehicleMasterEntity, (vehicle) => vehicle.vehicleFiles)
  @JoinColumn({ name: 'vehicleMasterId' })
  vehicleMaster: VehicleMasterEntity;

  @ManyToOne(() => VehicleEventEntity, (vehicleEvent) => vehicleEvent.vehicleFiles)
  @JoinColumn({ name: 'vehicleEventsId' })
  vehicleEvent?: VehicleEventEntity;
}
