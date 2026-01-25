import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCompaniesTable1798000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'companies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          // Basic Information
          { name: 'name', type: 'varchar', length: '255', isUnique: true },
          { name: 'website', type: 'varchar', length: '255', isNullable: true },
          { name: 'logo', type: 'varchar', length: '500', isNullable: true },
          { name: 'contactNumber', type: 'varchar', length: '20', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'gstNumber', type: 'varchar', length: '15', isNullable: true },
          // Address Information
          { name: 'blockNumber', type: 'varchar', length: '100', isNullable: true },
          { name: 'buildingName', type: 'varchar', length: '255', isNullable: true },
          { name: 'streetName', type: 'varchar', length: '255', isNullable: true },
          { name: 'landmark', type: 'varchar', length: '255', isNullable: true },
          { name: 'area', type: 'varchar', length: '255', isNullable: true },
          { name: 'city', type: 'varchar', length: '100', isNullable: true },
          { name: 'state', type: 'varchar', length: '100', isNullable: true },
          { name: 'pincode', type: 'varchar', length: '10', isNullable: true },
          { name: 'country', type: 'varchar', length: '100', isNullable: true },
          { name: 'fullAddress', type: 'text', isNullable: true },
          // Parent Company (Self-Reference)
          { name: 'parentCompanyId', type: 'uuid', isNullable: true },
          // Additional
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          // Audit
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

    // Create indexes
    await queryRunner.createIndex(
      'companies',
      new TableIndex({
        name: 'IDX_COMPANY_NAME',
        columnNames: ['name'],
      }),
    );

    await queryRunner.createIndex(
      'companies',
      new TableIndex({
        name: 'IDX_COMPANY_CITY',
        columnNames: ['city'],
      }),
    );

    await queryRunner.createIndex(
      'companies',
      new TableIndex({
        name: 'IDX_COMPANY_PARENT',
        columnNames: ['parentCompanyId'],
      }),
    );

    // Create foreign key for parent company (self-reference)
    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['parentCompanyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'SET NULL',
      }),
    );

    // Create foreign keys for audit fields
    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'companies',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('companies');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('companies', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('companies');
  }
}
