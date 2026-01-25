import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSitesTable1800000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create sites table
    await queryRunner.createTable(
      new Table({
        name: 'sites',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'companyId', type: 'uuid' },
          { name: 'managerName', type: 'varchar', length: '255' },
          { name: 'managerContact', type: 'varchar', length: '50', isNullable: true },
          { name: 'startDate', type: 'date' },
          { name: 'endDate', type: 'date', isNullable: true },
          { name: 'baseDistanceKm', type: 'decimal', precision: 10, scale: 2, isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'upcoming'" },
          // Address fields
          { name: 'blockNumber', type: 'varchar', length: '50', isNullable: true },
          { name: 'buildingName', type: 'varchar', length: '100', isNullable: true },
          { name: 'streetName', type: 'varchar', length: '255', isNullable: true },
          { name: 'landmark', type: 'varchar', length: '100', isNullable: true },
          { name: 'area', type: 'varchar', length: '100', isNullable: true },
          { name: 'city', type: 'varchar', length: '100', isNullable: true },
          { name: 'state', type: 'varchar', length: '100', isNullable: true },
          { name: 'pincode', type: 'varchar', length: '6', isNullable: true },
          { name: 'country', type: 'varchar', length: '100', isNullable: true },
          { name: 'fullAddress', type: 'text', isNullable: true },
          // Work types and notes
          { name: 'workTypes', type: 'jsonb', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          // Audit fields
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes for sites
    await queryRunner.createIndex(
      'sites',
      new TableIndex({ name: 'IDX_SITE_NAME', columnNames: ['name'] }),
    );
    await queryRunner.createIndex(
      'sites',
      new TableIndex({ name: 'IDX_SITE_COMPANY', columnNames: ['companyId'] }),
    );
    await queryRunner.createIndex(
      'sites',
      new TableIndex({ name: 'IDX_SITE_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'sites',
      new TableIndex({ name: 'IDX_SITE_START_DATE', columnNames: ['startDate'] }),
    );

    // Create foreign keys for sites
    await queryRunner.createForeignKey(
      'sites',
      new TableForeignKey({
        columnNames: ['companyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'sites',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'sites',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'sites',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Create site_contractors junction table
    await queryRunner.createTable(
      new Table({
        name: 'site_contractors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'siteId', type: 'uuid' },
          { name: 'contractorId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    // Create indexes for site_contractors
    await queryRunner.createIndex(
      'site_contractors',
      new TableIndex({ name: 'IDX_SITE_CONTRACTOR_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'site_contractors',
      new TableIndex({ name: 'IDX_SITE_CONTRACTOR_CONTRACTOR', columnNames: ['contractorId'] }),
    );
    await queryRunner.createIndex(
      'site_contractors',
      new TableIndex({
        name: 'IDX_SITE_CONTRACTOR_UNIQUE',
        columnNames: ['siteId', 'contractorId'],
        isUnique: true,
      }),
    );

    // Create foreign keys for site_contractors
    await queryRunner.createForeignKey(
      'site_contractors',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'site_contractors',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop site_contractors table first (due to foreign keys)
    const siteContractorsTable = await queryRunner.getTable('site_contractors');
    if (siteContractorsTable) {
      const foreignKeys = siteContractorsTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('site_contractors', foreignKey);
      }
    }
    await queryRunner.dropTable('site_contractors');

    // Drop sites table
    const sitesTable = await queryRunner.getTable('sites');
    if (sitesTable) {
      const foreignKeys = sitesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('sites', foreignKey);
      }
    }
    await queryRunner.dropTable('sites');
  }
}
