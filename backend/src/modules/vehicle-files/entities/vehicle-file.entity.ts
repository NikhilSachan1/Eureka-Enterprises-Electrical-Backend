import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { VehicleEntity } from 'src/modules/vehicles/entities/vehicle.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';

@Entity('vehicles_files')
@Index('idx_vehicles_files_vehicle_id', ['vehicleId'])
@Index('idx_vehicles_files_vehicle_events_id', ['vehicleEventsId'])
export class VehicleFileEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleId: string;

  @Column({ type: 'varchar', nullable: false })
  fileType: string;

  @Column({ type: 'varchar', nullable: false })
  fileKey: string;

  @Column({ type: 'uuid', nullable: true })
  vehicleEventsId: string;

  // Relations
  @ManyToOne(() => VehicleEntity, (vehicle) => vehicle.vehicleFiles)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleEntity;

  @ManyToOne(() => VehicleEventEntity, (vehicleEvents) => vehicleEvents.vehicleFiles)
  @JoinColumn({ name: 'vehicleEventsId' })
  vehicleEvents?: VehicleEventEntity;
}
