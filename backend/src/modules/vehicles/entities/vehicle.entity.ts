import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, OneToMany } from 'typeorm';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';

@Entity('vehicles')
@Index('idx_vehicles_number', ['number'])
@Index('idx_vehicles_brand', ['brand'])
export class VehicleEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  number: string;

  @Column({ type: 'varchar', nullable: false })
  brand: string;

  @Column({ type: 'varchar', nullable: false })
  model: string;

  @Column({ type: 'varchar', nullable: false })
  mileage: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => VehicleEventEntity, (vehicleEvents) => vehicleEvents.vehicle)
  vehicleEvents: VehicleEventEntity[];

  @OneToMany(() => VehicleFileEntity, (vehicleFiles) => vehicleFiles.vehicle)
  vehicleFiles: VehicleFileEntity[];
}
