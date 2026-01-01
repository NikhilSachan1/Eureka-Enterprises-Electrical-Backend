import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCronLogsTable1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'cron_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'jobName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'jobType',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'RUNNING'",
          },
          {
            name: 'startedAt',
            type: 'timestamp',
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'durationMs',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorStack',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'triggeredBy',
            type: 'varchar',
            length: '20',
            default: "'SYSTEM'",
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'cron_logs',
      new TableForeignKey({
        name: 'FK_cron_logs_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_job_name',
        columnNames: ['jobName'],
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_job_type',
        columnNames: ['jobType'],
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_started_at',
        columnNames: ['startedAt'],
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_created_at',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'cron_logs',
      new TableIndex({
        name: 'IDX_cron_logs_job_status_started',
        columnNames: ['jobName', 'status', 'startedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_job_status_started');
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_created_at');
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_started_at');
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_status');
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_job_type');
    await queryRunner.dropIndex('cron_logs', 'IDX_cron_logs_job_name');
    await queryRunner.dropForeignKey('cron_logs', 'FK_cron_logs_created_by');
    await queryRunner.dropTable('cron_logs');
  }
}
