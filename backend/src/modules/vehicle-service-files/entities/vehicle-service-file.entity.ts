import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { VehicleServiceEntity } from 'src/modules/vehicle-services/entities/vehicle-service.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('vehicle_service_files')
@Index('IDX_VEHICLE_SERVICE_FILES_SERVICE', ['vehicleServiceId'])
export class VehicleServiceFileEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleServiceId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  fileType: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  fileKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string;

  // Relations
  @ManyToOne(() => VehicleServiceEntity, (service) => service.serviceFiles)
  @JoinColumn({ name: 'vehicleServiceId' })
  vehicleService: VehicleServiceEntity;
}
