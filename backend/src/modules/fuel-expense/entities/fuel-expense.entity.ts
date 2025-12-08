import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { UserEntity } from 'src/modules/users/entities/user.entity';
import { VehicleMasterEntity } from 'src/modules/vehicle-masters/entities/vehicle-master.entity';
import { CardsEntity } from 'src/modules/cards/entities/card.entity';
import { FuelExpenseFilesEntity } from '../../fuel-expense-files/entities/fuel-expense-files.entity';

@Entity('fuel_expenses')
@Index('idx_fuel_expense_vehicle_id', ['vehicleId'])
@Index('idx_fuel_expense_card_id', ['cardId'])
@Index('idx_fuel_expense_user_id', ['userId'])
@Index('idx_fuel_expense_approval_status', ['approvalStatus'])
@Index('idx_fuel_expense_fill_date', ['fillDate'])
@Index('idx_fuel_expense_deleted_at', ['deletedAt'])
@Index('idx_fuel_expense_is_active', ['isActive'])
@Index('idx_fuel_expense_original_fuel_expense_id', ['originalFuelExpenseId'])
export class FuelExpenseEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  vehicleId: string;

  @Column({ type: 'uuid', nullable: true })
  cardId: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'timestamp', nullable: false })
  fillDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  odometerKm: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  fuelLiters: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false })
  fuelAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pumpMeterReading: number;

  @Column({ type: 'text', nullable: false })
  paymentMode: string;

  @Column({ type: 'text', nullable: true })
  transactionId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: false })
  transactionType: string;

  @Column({ type: 'varchar', nullable: false })
  expenseEntryType: string;

  @Column({ type: 'varchar', nullable: false })
  entrySourceType: string;

  @Column({ type: 'text', nullable: false, default: 'PENDING' })
  approvalStatus: string;

  @Column({ type: 'uuid', nullable: true })
  approvalBy: string;

  @Column({ type: 'text', nullable: true })
  approvalReason: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalAt: Date;

  @Column({ type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  originalFuelExpenseId: string;

  @Column({ type: 'uuid', nullable: true })
  parentFuelExpenseId: string;

  @Column({ type: 'integer', nullable: false, default: 1 })
  versionNumber: number;

  @Column({ type: 'text', nullable: true })
  editReason: string;

  // Relationships
  @ManyToOne(() => VehicleMasterEntity, { nullable: false })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: VehicleMasterEntity;

  @ManyToOne(() => CardsEntity, { nullable: true })
  @JoinColumn({ name: 'cardId' })
  card: CardsEntity;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'approvalBy' })
  approvalByUser: UserEntity;

  @OneToMany(() => FuelExpenseFilesEntity, (files) => files.fuelExpense)
  fuelExpenseFiles: FuelExpenseFilesEntity[];

  // Self-referencing relationships for history tracking
  @ManyToOne(() => FuelExpenseEntity, { nullable: true })
  @JoinColumn({ name: 'originalFuelExpenseId' })
  originalFuelExpense: FuelExpenseEntity;

  @ManyToOne(() => FuelExpenseEntity, { nullable: true })
  @JoinColumn({ name: 'parentFuelExpenseId' })
  parentFuelExpense: FuelExpenseEntity;
}
