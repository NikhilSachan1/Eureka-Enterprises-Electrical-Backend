import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAttendanceTable1749352656103 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'attendances',
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
            name: 'attendanceDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'checkInTime',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'checkOutTime',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'shiftConfigId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'entrySourceType',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'attendanceType',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'regularizedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvalStatus',
            type: 'text',
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
            name: 'approvalComment',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
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
      'attendances',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['shiftConfigId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'config_settings',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['regularizedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['approvalBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'attendances',
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
      'attendances',
      new TableIndex({
        name: 'IDX_attendances_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'attendances',
      new TableIndex({
        name: 'IDX_attendances_attendanceDate',
        columnNames: ['attendanceDate'],
      }),
    );

    await queryRunner.createIndex(
      'attendances',
      new TableIndex({
        name: 'IDX_attendances_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'attendances',
      new TableIndex({
        name: 'IDX_attendances_isActive',
        columnNames: ['isActive'],
      }),
    );

    await queryRunner.createIndex(
      'attendances',
      new TableIndex({
        name: 'IDX_attendances_deletedAt',
        columnNames: ['deletedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('attendances', 'IDX_attendances_deletedAt');
    await queryRunner.dropIndex('attendances', 'IDX_attendances_isActive');
    await queryRunner.dropIndex('attendances', 'IDX_attendances_status');
    await queryRunner.dropIndex('attendances', 'IDX_attendances_attendanceDate');
    await queryRunner.dropIndex('attendances', 'IDX_attendances_userId');
    await queryRunner.dropTable('attendances');
  }
}
