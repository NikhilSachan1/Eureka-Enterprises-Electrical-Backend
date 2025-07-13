import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateLeaveApplicationsTable1752166055238 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'leave_applications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'leaveConfigId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'leaveType',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'fromDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'toDate',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'varchar',
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
            isNullable: false,
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
      'leave_applications',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'leave_applications',
      new TableForeignKey({
        columnNames: ['leaveConfigId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'config_settings',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'leave_applications',
      new TableForeignKey({
        columnNames: ['approvalBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'leave_applications',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'leave_applications',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'leave_applications',
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
      'leave_applications',
      new TableIndex({
        name: 'idx_leave_applications_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'leave_applications',
      new TableIndex({
        name: 'idx_leave_applications_leaveConfigId',
        columnNames: ['leaveConfigId'],
      }),
    );

    await queryRunner.createIndex(
      'leave_applications',
      new TableIndex({
        name: 'idx_leave_applications_approvalBy',
        columnNames: ['approvalBy'],
      }),
    );

    await queryRunner.createIndex(
      'leave_applications',
      new TableIndex({
        name: 'idx_leave_applications_approvalStatus',
        columnNames: ['approvalStatus'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('leave_applications');
  }
}
