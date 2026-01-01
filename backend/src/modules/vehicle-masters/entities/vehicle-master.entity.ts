import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';
import { VehicleEventEntity } from 'src/modules/vehicle-events/entities/vehicle-event.entity';
import { VehicleVersionEntity } from 'src/modules/vehicle-versions/entities/vehicle-versions.entity';
import { CardsEntity } from 'src/modules/cards/entities/card.entity';

@Entity('vehicle_masters')
@Index('idx_vehicle_masters_cardId', ['cardId'])
export class VehicleMasterEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  registrationNo: string;

  @Column({ type: 'uuid', nullable: true, unique: true })
  cardId: string;

  @ManyToOne(() => CardsEntity, { nullable: true })
  @JoinColumn({ name: 'cardId' })
  card: CardsEntity;

  @OneToMany(() => VehicleVersionEntity, (vehicleVersions) => vehicleVersions.vehicleMaster)
  vehicleVersions: VehicleVersionEntity[];

  @OneToMany(() => VehicleEventEntity, (vehicleEvents) => vehicleEvents.vehicleMaster)
  vehicleEvents: VehicleEventEntity[];

  @OneToMany(() => VehicleFileEntity, (vehicleFiles) => vehicleFiles.vehicleMaster)
  vehicleFiles: VehicleFileEntity[];
}
