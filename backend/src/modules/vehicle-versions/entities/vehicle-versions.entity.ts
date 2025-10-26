import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('vehicle_versions')
@Index('idx_vehicles_number', ['number'])
@Index('idx_vehicles_brand', ['brand'])
export class VehicleVersionEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  number: string;

  @Column({ type: 'uuid', nullable: false })
  vehicleMasterId: string;

  @Column({ type: 'varchar', nullable: false })
  brand: string;

  @Column({ type: 'varchar', nullable: false })
  model: string;

  @Column({ type: 'varchar', nullable: false })
  mileage: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  additionalData: Record<string, any>;

  @ManyToOne(() => VehicleMasterEntity, (vehicleMaster) => vehicleMaster.vehicleVersions)
  @JoinColumn({ name: 'vehicleMasterId' })
  vehicleMaster: VehicleMasterEntity;
}
