import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVendorsTable1830000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vendors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          // Basic Information
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255' },
          { name: 'contactNumber', type: 'varchar', length: '20' },
          { name: 'vendorType', type: 'varchar', length: '20', default: "'GST_REGISTERED'" },
          { name: 'gstNumber', type: 'varchar', length: '15', isNullable: true },
          { name: 'panNumber', type: 'varchar', length: '10', isNullable: true },
          // Address Information
          { name: 'blockNumber', type: 'varchar', length: '50', isNullable: true },
          { name: 'buildingName', type: 'varchar', length: '100', isNullable: true },
          { name: 'streetName', type: 'varchar', length: '255', isNullable: true },
          { name: 'landmark', type: 'varchar', length: '100', isNullable: true },
          { name: 'area', type: 'varchar', length: '100', isNullable: true },
          { name: 'city', type: 'varchar', length: '100' },
          { name: 'state', type: 'varchar', length: '100' },
          { name: 'pincode', type: 'varchar', length: '6' },
          { name: 'country', type: 'varchar', length: '100', default: "'India'" },
          { name: 'fullAddress', type: 'text', isNullable: true },
          // Bank Details
          { name: 'bankName', type: 'varchar', length: '100', isNullable: true },
          { name: 'accountNumber', type: 'varchar', length: '20', isNullable: true },
          { name: 'ifscCode', type: 'varchar', length: '11', isNullable: true },
          { name: 'accountHolderName', type: 'varchar', length: '100', isNullable: true },
          // Additional
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    // Indexes
    await queryRunner.createIndex(
      'vendors',
      new TableIndex({ name: 'IDX_VENDOR_NAME', columnNames: ['name'] }),
    );
    await queryRunner.createIndex(
      'vendors',
      new TableIndex({ name: 'IDX_VENDOR_GST', columnNames: ['gstNumber'] }),
    );
    await queryRunner.createIndex(
      'vendors',
      new TableIndex({ name: 'IDX_VENDOR_CITY', columnNames: ['city'] }),
    );
    await queryRunner.createIndex(
      'vendors',
      new TableIndex({ name: 'IDX_VENDOR_TYPE', columnNames: ['vendorType'] }),
    );

    // CHECK constraint: vendorType ↔ gstNumber consistency (BRD §2)
    await queryRunner.query(`
      ALTER TABLE vendors
      ADD CONSTRAINT chk_vendor_type_gst CHECK (
        ("vendorType" = 'GST_REGISTERED' AND "gstNumber" IS NOT NULL)
        OR ("vendorType" = 'FREELANCER' AND "gstNumber" IS NULL)
      )
    `);

    // Foreign keys for audit fields
    await queryRunner.createForeignKey(
      'vendors',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vendors',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vendors',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendors');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('vendors', fk);
      }
    }
    await queryRunner.dropTable('vendors');
  }
}
