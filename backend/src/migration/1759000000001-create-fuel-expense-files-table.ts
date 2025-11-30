import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateFuelExpenseFilesTable1759000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fuel_expense_files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'fuelExpenseId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fileKey',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Foreign key to fuel_expense
    await queryRunner.createForeignKey(
      'fuel_expense_files',
      new TableForeignKey({
        columnNames: ['fuelExpenseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'fuel_expense',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (created_by)
    await queryRunner.createForeignKey(
      'fuel_expense_files',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (updated_by)
    await queryRunner.createForeignKey(
      'fuel_expense_files',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (deleted_by)
    await queryRunner.createForeignKey(
      'fuel_expense_files',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'fuel_expense_files',
      new TableIndex({
        name: 'idx_fuel_expense_files_fuel_expense_id',
        columnNames: ['fuelExpenseId'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expense_files',
      new TableIndex({
        name: 'idx_fuel_expense_files_file_key',
        columnNames: ['fileKey'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fuel_expense_files');
  }
}
