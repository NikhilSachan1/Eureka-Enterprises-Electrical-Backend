import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateFuelExpenseTable1759000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fuel_expenses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vehicleId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'cardId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fillDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'odometerKm',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'fuelLiters',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'fuelAmount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'pumpMeterReading',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'paymentMode',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'transactionId',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'approvalStatus',
            type: 'text',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'approvalBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvalReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'approvalAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'originalFuelExpenseId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'parentFuelExpenseId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'versionNumber',
            type: 'integer',
            default: 1,
            isNullable: false,
          },
          {
            name: 'editReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Foreign key to vehicle_master
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['vehicleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_masters',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to cards (optional)
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['cardId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'cards',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (user_id - who filled the fuel)
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (approved_by)
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['approvalBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (created_by)
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Foreign key to users (updated_by)
    await queryRunner.createForeignKey(
      'fuel_expenses',
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
      'fuel_expenses',
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
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_vehicle_id',
        columnNames: ['vehicleId'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_card_id',
        columnNames: ['cardId'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_approval_status',
        columnNames: ['approvalStatus'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_fill_date',
        columnNames: ['fillDate'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_deleted_at',
        columnNames: ['deletedAt'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_is_active',
        columnNames: ['isActive'],
      }),
    );

    await queryRunner.createIndex(
      'fuel_expenses',
      new TableIndex({
        name: 'idx_fuel_expense_original_fuel_expense_id',
        columnNames: ['originalFuelExpenseId'],
      }),
    );

    // Self-referencing foreign keys for history tracking
    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['originalFuelExpenseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'fuel_expenses',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'fuel_expenses',
      new TableForeignKey({
        columnNames: ['parentFuelExpenseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'fuel_expenses',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fuel_expenses');
  }
}
