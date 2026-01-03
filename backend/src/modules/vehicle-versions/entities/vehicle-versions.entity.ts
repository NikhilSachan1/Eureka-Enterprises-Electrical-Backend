import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { VehicleFileEntity } from 'src/modules/vehicle-files/entities/vehicle-file.entity';

@Entity('vehicle_versions')
@Index('idx_vehicles_registrationNo', ['registrationNo'])
@Index('idx_vehicles_brand', ['brand'])
@Index('IDX_VEHICLE_VERSIONS_FUEL_TYPE', ['fuelType'])
@Index('IDX_VEHICLE_VERSIONS_STATUS', ['status'])
@Index('IDX_VEHICLE_VERSIONS_ASSIGNED_TO', ['assignedTo'])
@Index('IDX_VEHICLE_VERSIONS_INSURANCE_END', ['insuranceEndDate'])
@Index('IDX_VEHICLE_VERSIONS_PUC_END', ['pucEndDate'])
@Index('IDX_VEHICLE_VERSIONS_FITNESS_END', ['fitnessEndDate'])
export class VehicleVersionEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleMasterId: string;

  // Basic Info
  @Column({ type: 'varchar', nullable: false })
  registrationNo: string;

  @Column({ type: 'varchar', nullable: false })
  brand: string;

  @Column({ type: 'varchar', nullable: false })
  model: string;

  @Column({ type: 'varchar', nullable: false })
  mileage: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  fuelType: string;

  // Purchase Info
  @Column({ type: 'date', nullable: true })
  purchaseDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  dealerName: string;

  // Insurance
  @Column({ type: 'date', nullable: true })
  insuranceStartDate: Date;

  @Column({ type: 'date', nullable: true })
  insuranceEndDate: Date;

  // PUC
  @Column({ type: 'date', nullable: true })
  pucStartDate: Date;

  @Column({ type: 'date', nullable: true })
  pucEndDate: Date;

  // Fitness
  @Column({ type: 'date', nullable: true })
  fitnessStartDate: Date;

  @Column({ type: 'date', nullable: true })
  fitnessEndDate: Date;

  // Status & Assignment
  @Column({ type: 'varchar', length: 50, nullable: false, default: 'AVAILABLE' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  assignedTo: string;

  // Remarks
  @Column({ type: 'text', nullable: true })
  remarks: string;

  // Service tracking
  @Column({ type: 'integer', nullable: true })
  lastServiceKm: number;

  @Column({ type: 'date', nullable: true })
  lastServiceDate: Date;

  // Version control
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  additionalData: Record<string, any>;

  // Relations
  @ManyToOne(() => VehicleMasterEntity, (vehicleMaster) => vehicleMaster.vehicleVersions)
  @JoinColumn({ name: 'vehicleMasterId' })
  vehicleMaster: VehicleMasterEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'assignedTo' })
  assignedToUser: UserEntity;

  @OneToMany(() => VehicleFileEntity, (vehicleFile) => vehicleFile.vehicleVersion)
  vehicleFiles: VehicleFileEntity[];
}
