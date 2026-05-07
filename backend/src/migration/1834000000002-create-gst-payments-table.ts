import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateGstPaymentsTable1834000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'gst_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'siteId', type: 'uuid' },
          { name: 'vendorId', type: 'uuid' },
          { name: 'paymentMonth', type: 'char', length: '7' },
          { name: 'financialYear', type: 'varchar', length: '10' },
          { name: 'netAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'utrNumber', type: 'varchar', length: '100' },
          { name: 'paymentDate', type: 'date' },
          { name: 'fileKey', type: 'varchar', length: '500', isNullable: true },
          { name: 'fileName', type: 'varchar', length: '255', isNullable: true },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'paymentAdviceReferenceNumber', type: 'varchar', length: '50' },
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
      'gst_payments',
      new TableIndex({ name: 'IDX_GST_PAYMENT_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'gst_payments',
      new TableIndex({ name: 'IDX_GST_PAYMENT_VENDOR', columnNames: ['vendorId'] }),
    );
    await queryRunner.createIndex(
      'gst_payments',
      new TableIndex({ name: 'IDX_GST_PAYMENT_MONTH', columnNames: ['paymentMonth'] }),
    );

    // Unique partial index — one payment per (site, vendor, month)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_GST_PAYMENT_SITE_VENDOR_MONTH"
      ON gst_payments("siteId", "vendorId", "paymentMonth")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.createForeignKey(
      'gst_payments',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'gst_payments',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy']) {
      await queryRunner.createForeignKey(
        'gst_payments',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        }),
      );
    }

    // Add FK from gst_register_entries to gst_payments
    await queryRunner.createForeignKey(
      'gst_register_entries',
      new TableForeignKey({
        columnNames: ['gstPaymentId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'gst_payments',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK from gst_register_entries first
    const registerTable = await queryRunner.getTable('gst_register_entries');
    if (registerTable) {
      const fk = registerTable.foreignKeys.find(
        (f) => f.columnNames.includes('gstPaymentId'),
      );
      if (fk) {
        await queryRunner.dropForeignKey('gst_register_entries', fk);
      }
    }

    const table = await queryRunner.getTable('gst_payments');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('gst_payments', fk);
      }
    }
    await queryRunner.dropTable('gst_payments');
  }
}
