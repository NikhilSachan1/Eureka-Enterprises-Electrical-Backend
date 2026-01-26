import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSiteStatusHistoryTable1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create site_status_history table
    await queryRunner.createTable(
      new Table({
        name: 'site_status_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'siteId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fromStatus',
            type: 'varchar',
            length: '20',
            isNullable: true, // null for initial status when site is created
          },
          {
            name: 'toStatus',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'changedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'changedBy',
            type: 'uuid',
            isNullable: false,
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
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
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

    // Create indexes
    await queryRunner.createIndex(
      'site_status_history',
      new TableIndex({
        name: 'IDX_SITE_STATUS_HISTORY_SITE',
        columnNames: ['siteId'],
      }),
    );

    await queryRunner.createIndex(
      'site_status_history',
      new TableIndex({
        name: 'IDX_SITE_STATUS_HISTORY_CHANGED_AT',
        columnNames: ['changedAt'],
      }),
    );

    await queryRunner.createIndex(
      'site_status_history',
      new TableIndex({
        name: 'IDX_SITE_STATUS_HISTORY_CHANGED_BY',
        columnNames: ['changedBy'],
      }),
    );

    // Create foreign key to sites table
    await queryRunner.createForeignKey(
      'site_status_history',
      new TableForeignKey({
        name: 'FK_SITE_STATUS_HISTORY_SITE',
        columnNames: ['siteId'],
        referencedTableName: 'sites',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create foreign key to users table for changedBy
    await queryRunner.createForeignKey(
      'site_status_history',
      new TableForeignKey({
        name: 'FK_SITE_STATUS_HISTORY_CHANGED_BY',
        columnNames: ['changedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('site_status_history', 'FK_SITE_STATUS_HISTORY_CHANGED_BY');
    await queryRunner.dropForeignKey('site_status_history', 'FK_SITE_STATUS_HISTORY_SITE');

    // Drop indexes
    await queryRunner.dropIndex('site_status_history', 'IDX_SITE_STATUS_HISTORY_CHANGED_BY');
    await queryRunner.dropIndex('site_status_history', 'IDX_SITE_STATUS_HISTORY_CHANGED_AT');
    await queryRunner.dropIndex('site_status_history', 'IDX_SITE_STATUS_HISTORY_SITE');

    // Drop table
    await queryRunner.dropTable('site_status_history');
  }
}
