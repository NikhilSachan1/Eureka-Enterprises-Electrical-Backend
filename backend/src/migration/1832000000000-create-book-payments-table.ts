import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBookPaymentsTable1832000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'book_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'invoiceId', type: 'uuid' },
          { name: 'siteId', type: 'uuid' },
          { name: 'vendorId', type: 'uuid' },
          { name: 'poId', type: 'uuid' },
          { name: 'bookingDate', type: 'date' },
          { name: 'taxableAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'gstAmount', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'tdsDeductionAmount', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'paymentTotalAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'paymentHoldReason', type: 'text', isNullable: true },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'APPROVED'" },
          { name: 'approvalBy', type: 'uuid', isNullable: true },
          { name: 'approvalAt', type: 'timestamptz', isNullable: true },
          { name: 'hasTransfer', type: 'boolean', default: false },
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
      'book_payments',
      new TableIndex({ name: 'IDX_BOOK_PAYMENT_INVOICE', columnNames: ['invoiceId'] }),
    );
    await queryRunner.createIndex(
      'book_payments',
      new TableIndex({ name: 'IDX_BOOK_PAYMENT_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'book_payments',
      new TableIndex({ name: 'IDX_BOOK_PAYMENT_VENDOR', columnNames: ['vendorId'] }),
    );
    await queryRunner.createIndex(
      'book_payments',
      new TableIndex({ name: 'IDX_BOOK_PAYMENT_PO', columnNames: ['poId'] }),
    );

    await queryRunner.query(`
      ALTER TABLE book_payments
      ADD CONSTRAINT chk_book_payment_amount CHECK ("paymentTotalAmount" = "taxableAmount" + "gstAmount" - "tdsDeductionAmount")
    `);

    for (const [col, ref, action] of [
      ['invoiceId', 'site_invoices', 'RESTRICT'],
      ['siteId', 'sites', 'RESTRICT'],
      ['vendorId', 'vendors', 'RESTRICT'],
      ['poId', 'purchase_orders', 'RESTRICT'],
    ] as const) {
      await queryRunner.createForeignKey(
        'book_payments',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: ref,
          onDelete: action,
        }),
      );
    }
    for (const col of ['createdBy', 'updatedBy', 'deletedBy', 'approvalBy']) {
      await queryRunner.createForeignKey(
        'book_payments',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('book_payments');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('book_payments', fk);
      }
    }
    await queryRunner.dropTable('book_payments');
  }
}
