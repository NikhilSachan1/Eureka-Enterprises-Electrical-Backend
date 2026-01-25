import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateContractorsTable1799000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'contractors',
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
          { name: 'gstNumber', type: 'varchar', length: '15', isNullable: true },
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
          // Bank Details (optional)
          { name: 'bankName', type: 'varchar', length: '100', isNullable: true },
          { name: 'accountNumber', type: 'varchar', length: '20', isNullable: true },
          { name: 'ifscCode', type: 'varchar', length: '11', isNullable: true },
          { name: 'accountHolderName', type: 'varchar', length: '100', isNullable: true },
          // Self Contractor Flag
          { name: 'isSelfContractor', type: 'boolean', default: false },
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

    // Create indexes
    await queryRunner.createIndex(
      'contractors',
      new TableIndex({
        name: 'IDX_CONTRACTOR_NAME',
        columnNames: ['name'],
      }),
    );

    await queryRunner.createIndex(
      'contractors',
      new TableIndex({
        name: 'IDX_CONTRACTOR_GST',
        columnNames: ['gstNumber'],
      }),
    );

    await queryRunner.createIndex(
      'contractors',
      new TableIndex({
        name: 'IDX_CONTRACTOR_CITY',
        columnNames: ['city'],
      }),
    );

    await queryRunner.createIndex(
      'contractors',
      new TableIndex({
        name: 'IDX_CONTRACTOR_SELF',
        columnNames: ['isSelfContractor'],
      }),
    );

    // Create foreign keys for audit fields
    await queryRunner.createForeignKey(
      'contractors',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'contractors',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'contractors',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Insert default self-contractor (Eureka Enterprises)
    await queryRunner.query(`
      INSERT INTO contractors (
        "name",
        "email",
        "contactNumber",
        "city",
        "state",
        "pincode",
        "country",
        "fullAddress",
        "isSelfContractor",
        "isActive",
        "remarks"
      ) VALUES (
        'Eureka Enterprises Pvt Ltd',
        'hr@eurekaenterprises.com',
        '5101234567',
        'Jhansi',
        'Uttar Pradesh',
        '284001',
        'India',
        'Jhansi, Uttar Pradesh - 284001, India',
        true,
        true,
        'Default self contractor - Company owned sites'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('contractors');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('contractors', foreignKey);
      }
    }

    // Drop table
    await queryRunner.dropTable('contractors');
  }
}
