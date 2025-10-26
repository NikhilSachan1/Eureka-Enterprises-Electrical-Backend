import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, OneToMany } from 'typeorm';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';
import { VehicleVersionEntity } from 'src/modules/vehicle-versions/entities/vehicle-versions.entity';

@Entity('vehicle_masters')
export class VehicleMasterEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  registrationNo: string;

  @OneToMany(() => VehicleVersionEntity, (vehicleVersions) => vehicleVersions.vehicleMaster)
  vehicleVersions: VehicleVersionEntity[];

  @OneToMany(() => VehicleEventEntity, (vehicleEvents) => vehicleEvents.vehicleMaster)
  vehicleEvents: VehicleEventEntity[];

  @OneToMany(() => VehicleFileEntity, (vehicleFiles) => vehicleFiles.vehicleMaster)
  vehicleFiles: VehicleFileEntity[];
}
