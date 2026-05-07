import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateTdsPaymentsTable1834000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tds_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'siteId', type: 'uuid' },
          { name: 'partyType', type: 'varchar', length: '20' },
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'vendorId', type: 'uuid', isNullable: true },
          { name: 'paymentMonth', type: 'char', length: '7' },
          { name: 'financialYear', type: 'varchar', length: '10' },
          { name: 'netAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'utrNumber', type: 'varchar', length: '100' },
          { name: 'paymentDate', type: 'date' },
          { name: 'fileKey', type: 'varchar', length: '500', isNullable: true },
          { name: 'fileName', type: 'varchar', length: '255', isNullable: true },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'APPROVED'" },
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

    await queryRunner.createIndex(
      'tds_payments',
      new TableIndex({ name: 'IDX_TDS_PAYMENT_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'tds_payments',
      new TableIndex({ name: 'IDX_TDS_PAYMENT_PARTY_TYPE', columnNames: ['partyType'] }),
    );
    await queryRunner.createIndex(
      'tds_payments',
      new TableIndex({ name: 'IDX_TDS_PAYMENT_MONTH', columnNames: ['paymentMonth'] }),
    );

    // CHECK constraint for partyType
    await queryRunner.query(`
      ALTER TABLE tds_payments
      ADD CONSTRAINT chk_tds_payment_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);

    // Unique partial index — one payment per (site, partyType, party, month)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_TDS_PAYMENT_SALE"
      ON tds_payments("siteId", "partyType", "contractorId", "paymentMonth")
      WHERE "deletedAt" IS NULL AND "partyType" = 'SALE'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_TDS_PAYMENT_PURCHASE"
      ON tds_payments("siteId", "partyType", "vendorId", "paymentMonth")
      WHERE "deletedAt" IS NULL AND "partyType" = 'PURCHASE'
    `);

    await queryRunner.createForeignKey(
      'tds_payments',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'tds_payments',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'tds_payments',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy']) {
      await queryRunner.createForeignKey(
        'tds_payments',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        }),
      );
    }

    // Add FK from tds_register_entries to tds_payments
    await queryRunner.createForeignKey(
      'tds_register_entries',
      new TableForeignKey({
        columnNames: ['tdsPaymentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tds_payments',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK from tds_register_entries first
    const registerTable = await queryRunner.getTable('tds_register_entries');
    if (registerTable) {
      const fk = registerTable.foreignKeys.find(
        (f) => f.columnNames.includes('tdsPaymentId'),
      );
      if (fk) {
        await queryRunner.dropForeignKey('tds_register_entries', fk);
      }
    }

    const table = await queryRunner.getTable('tds_payments');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('tds_payments', fk);
      }
    }
    await queryRunner.dropTable('tds_payments');
  }
}
