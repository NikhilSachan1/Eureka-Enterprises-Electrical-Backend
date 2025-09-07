import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { VehicleEntity } from 'src/modules/vehicles/entities/vehicle.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';

@Entity('vehicles_events')
@Index('idx_vehicles_events_vehicle_id', ['vehicleId'])
@Index('idx_vehicles_events_from_user', ['fromUser'])
@Index('idx_vehicles_events_to_user', ['toUser'])
@Index('idx_vehicles_events_created_by', ['createdBy'])
export class VehicleEventEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleId: string;

  @Column({ type: 'varchar', nullable: false })
  eventType: string;

  @Column({ type: 'uuid', nullable: true })
  fromUser?: string;

  @Column({ type: 'uuid', nullable: true })
  toUser?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // Relations
  @ManyToOne(() => VehicleEntity, (vehicle) => vehicle.vehicleEvents)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'fromUser' })
  fromUserEntity?: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'toUser' })
  toUserEntity?: UserEntity;

  @OneToMany(() => VehicleFileEntity, (vehicleFile) => vehicleFile.vehicleEvents)
  vehicleFiles: VehicleFileEntity[];
}
