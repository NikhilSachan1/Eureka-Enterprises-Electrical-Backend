import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTransactionFieldsToFuelExpense1759000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add transaction_type column
    await queryRunner.addColumn(
      'fuel_expenses',
      new TableColumn({
        name: 'transactionType',
        type: 'varchar',
        isNullable: false,
        default: "'debit'",
      }),
    );

    // Add expense_entry_type column
    await queryRunner.addColumn(
      'fuel_expenses',
      new TableColumn({
        name: 'expenseEntryType',
        type: 'varchar',
        isNullable: false,
        default: "'self'",
      }),
    );

    // Add entry_source_type column
    await queryRunner.addColumn(
      'fuel_expenses',
      new TableColumn({
        name: 'entrySourceType',
        type: 'varchar',
        isNullable: false,
        default: "'web'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fuel_expenses', 'transactionType');
    await queryRunner.dropColumn('fuel_expenses', 'expenseEntryType');
    await queryRunner.dropColumn('fuel_expenses', 'entrySourceType');
  }
}
