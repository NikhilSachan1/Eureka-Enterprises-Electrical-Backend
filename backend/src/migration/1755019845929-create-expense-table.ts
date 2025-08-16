import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateExpenseTable1755019845929 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'expenses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'category',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            isNullable: false,
          },
          {
            name: 'transactionId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'expenseDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'approvalStatus',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'approvalBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvalAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'approvalReason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'transactionType',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'paymentMode',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'entrySourceType',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'expenseEntryType',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'originalExpenseId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'parentExpenseId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'versionNumber',
            type: 'integer',
            isNullable: false,
            default: 1,
          },
          {
            name: 'editReason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
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

    // Create foreign keys
    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['approvalBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['originalExpenseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'expenses',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['parentExpenseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'expenses',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'expenses',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'expenses',
      new TableIndex({
        name: 'idx_expenses_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'expenses',
      new TableIndex({
        name: 'idx_expenses_approvalBy',
        columnNames: ['approvalBy'],
      }),
    );

    await queryRunner.createIndex(
      'expenses',
      new TableIndex({
        name: 'idx_expenses_approvalStatus',
        columnNames: ['approvalStatus'],
      }),
    );

    await queryRunner.createIndex(
      'expenses',
      new TableIndex({
        name: 'idx_expenses_originalExpenseId',
        columnNames: ['originalExpenseId'],
      }),
    );

    await queryRunner.createIndex(
      'expenses',
      new TableIndex({
        name: 'idx_expenses_isActive',
        columnNames: ['isActive'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('expenses');
  }
}
