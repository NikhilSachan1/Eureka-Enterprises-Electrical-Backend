import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';
import { FuelExpenseEntity } from '../../fuel-expense/entities/fuel-expense.entity';

@Entity('fuel_expense_files')
@Index('idx_fuel_expense_files_fuel_expense_id', ['fuelExpenseId'])
@Index('idx_fuel_expense_files_file_key', ['fileKey'])
export class FuelExpenseFilesEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  fuelExpenseId: string;

  @Column({ type: 'varchar', nullable: false })
  fileKey: string;

  // Relationships
  @ManyToOne(() => FuelExpenseEntity, (fuelExpense) => fuelExpense.fuelExpenseFiles)
  @JoinColumn({ name: 'fuelExpenseId' })
  fuelExpense: FuelExpenseEntity;
}
