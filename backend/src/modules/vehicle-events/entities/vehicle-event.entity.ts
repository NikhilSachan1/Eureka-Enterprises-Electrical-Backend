import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';

@Entity('vehicles_events')
@Index('idx_vehicles_events_from_user', ['fromUser'])
@Index('idx_vehicles_events_to_user', ['toUser'])
@Index('idx_vehicles_events_created_by', ['createdBy'])
export class VehicleEventEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  eventType: string;

  @Column({ type: 'uuid', nullable: true })
  fromUser?: string;

  @Column({ type: 'uuid', nullable: true })
  toUser?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Relations
  @ManyToOne(() => VehicleMasterEntity, (vehicle) => vehicle.vehicleEvents)
  @JoinColumn({ name: 'vehicleMasterId' })
  vehicleMaster: VehicleMasterEntity;

  @OneToMany(() => VehicleFileEntity, (vehicleFile) => vehicleFile.vehicleEvent)
  vehicleFiles: VehicleFileEntity[];
}
