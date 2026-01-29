import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateDsrTables1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create daily_status_reports table
    await queryRunner.createTable(
      new Table({
        name: 'daily_status_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'siteId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reportDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'workTypes',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'workDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'hoursWorked',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'challenges',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reportingEngineerName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'reportingEngineerContact',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'weatherCondition',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'manpowerCount',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'equipmentUsed',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'APPROVED'",
          },
          {
            name: 'approvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'remarks',
            type: 'text',
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
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        uniques: [
          {
            name: 'UQ_DSR_SITE_USER_DATE',
            columnNames: ['siteId', 'userId', 'reportDate'],
          },
        ],
      }),
      true,
    );

    // Create indexes for daily_status_reports
    await queryRunner.createIndex(
      'daily_status_reports',
      new TableIndex({ name: 'IDX_DSR_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'daily_status_reports',
      new TableIndex({ name: 'IDX_DSR_USER', columnNames: ['userId'] }),
    );
    await queryRunner.createIndex(
      'daily_status_reports',
      new TableIndex({ name: 'IDX_DSR_REPORT_DATE', columnNames: ['reportDate'] }),
    );
    await queryRunner.createIndex(
      'daily_status_reports',
      new TableIndex({ name: 'IDX_DSR_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'daily_status_reports',
      new TableIndex({ name: 'IDX_DSR_DELETED_AT', columnNames: ['deletedAt'] }),
    );

    // Create foreign keys for daily_status_reports
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_SITE',
        columnNames: ['siteId'],
        referencedTableName: 'sites',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_USER',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_APPROVED_BY',
        columnNames: ['approvedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_CREATED_BY',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_UPDATED_BY',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'daily_status_reports',
      new TableForeignKey({
        name: 'FK_DSR_DELETED_BY',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create dsr_files table
    await queryRunner.createTable(
      new Table({
        name: 'dsr_files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'dsrId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fileKey',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'fileName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'fileType',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'fileSize',
            type: 'bigint',
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
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
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

    // Create indexes for dsr_files
    await queryRunner.createIndex(
      'dsr_files',
      new TableIndex({ name: 'IDX_DSR_FILE_DSR', columnNames: ['dsrId'] }),
    );
    await queryRunner.createIndex(
      'dsr_files',
      new TableIndex({ name: 'IDX_DSR_FILE_TYPE', columnNames: ['fileType'] }),
    );

    // Create foreign key for dsr_files
    await queryRunner.createForeignKey(
      'dsr_files',
      new TableForeignKey({
        name: 'FK_DSR_FILE_DSR',
        columnNames: ['dsrId'],
        referencedTableName: 'daily_status_reports',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create dsr_edit_history table
    await queryRunner.createTable(
      new Table({
        name: 'dsr_edit_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'dsrId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'editedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'editedAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'previousValues',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'newValues',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'changeReason',
            type: 'text',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for dsr_edit_history
    await queryRunner.createIndex(
      'dsr_edit_history',
      new TableIndex({ name: 'IDX_DSR_EDIT_HISTORY_DSR', columnNames: ['dsrId'] }),
    );
    await queryRunner.createIndex(
      'dsr_edit_history',
      new TableIndex({ name: 'IDX_DSR_EDIT_HISTORY_EDITED_BY', columnNames: ['editedBy'] }),
    );
    await queryRunner.createIndex(
      'dsr_edit_history',
      new TableIndex({ name: 'IDX_DSR_EDIT_HISTORY_EDITED_AT', columnNames: ['editedAt'] }),
    );

    // Create foreign keys for dsr_edit_history
    await queryRunner.createForeignKey(
      'dsr_edit_history',
      new TableForeignKey({
        name: 'FK_DSR_EDIT_HISTORY_DSR',
        columnNames: ['dsrId'],
        referencedTableName: 'daily_status_reports',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'dsr_edit_history',
      new TableForeignKey({
        name: 'FK_DSR_EDIT_HISTORY_EDITED_BY',
        columnNames: ['editedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('dsr_edit_history');
    await queryRunner.dropTable('dsr_files');
    await queryRunner.dropTable('daily_status_reports');
  }
}
