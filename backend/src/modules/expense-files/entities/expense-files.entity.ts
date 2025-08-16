import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from 'src/utils/base-entity/base-entity';

@Entity('expense_files')
@Index('idx_expense_files_expenseId', ['expenseId'])
@Index('idx_expense_files_fileKey', ['fileKey'])
export class ExpenseFilesEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: false })
  expenseId: string;

  @Column({ type: 'varchar', nullable: false })
  fileKey: string;
}
