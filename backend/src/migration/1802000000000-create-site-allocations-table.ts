import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSiteAllocationsTable1802000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create site_allocations table
    await queryRunner.createTable(
      new Table({
        name: 'site_allocations',
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
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'allocationType',
            type: 'varchar',
            length: '50',
            default: "'full_time'",
          },
          {
            name: 'role',
            type: 'varchar',
            length: '100',
            default: "'Engineer'",
          },
          {
            name: 'dailyAllowance',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'allocatedAt',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'deallocatedAt',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'isCurrentlyAllocated',
            type: 'boolean',
            default: true,
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
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'site_allocations',
      new TableIndex({
        name: 'IDX_SITE_ALLOCATION_SITE_ID',
        columnNames: ['siteId'],
      }),
    );

    await queryRunner.createIndex(
      'site_allocations',
      new TableIndex({
        name: 'IDX_SITE_ALLOCATION_USER_ID',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'site_allocations',
      new TableIndex({
        name: 'IDX_SITE_ALLOCATION_IS_CURRENT',
        columnNames: ['isCurrentlyAllocated'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'site_allocations',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedTableName: 'sites',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'site_allocations',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'site_allocations',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'site_allocations',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'site_allocations',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('site_allocations');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('site_allocations', fk);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('site_allocations', 'IDX_SITE_ALLOCATION_SITE_ID');
    await queryRunner.dropIndex('site_allocations', 'IDX_SITE_ALLOCATION_USER_ID');
    await queryRunner.dropIndex('site_allocations', 'IDX_SITE_ALLOCATION_IS_CURRENT');

    // Drop table
    await queryRunner.dropTable('site_allocations');
  }
}
