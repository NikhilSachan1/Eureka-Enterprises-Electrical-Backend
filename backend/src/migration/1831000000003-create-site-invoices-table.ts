import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSiteInvoicesTable1831000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'site_invoices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'jmcId', type: 'uuid' },
          { name: 'reportId', type: 'uuid', isNullable: true },
          { name: 'siteId', type: 'uuid' },
          { name: 'partyType', type: 'varchar', length: '20' },
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'vendorId', type: 'uuid', isNullable: true },
          { name: 'poId', type: 'uuid' },
          { name: 'invoiceNumber', type: 'varchar', length: '100' },
          { name: 'invoiceDate', type: 'date' },
          { name: 'taxableAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'gstAmount', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'tdsAmount', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'totalAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'fileKey', type: 'varchar', length: '500' },
          { name: 'fileName', type: 'varchar', length: '255' },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'PENDING'" },
          { name: 'approvalBy', type: 'uuid', isNullable: true },
          { name: 'approvalAt', type: 'timestamptz', isNullable: true },
          { name: 'approvalReason', type: 'text', isNullable: true },
          { name: 'isLocked', type: 'boolean', default: false },
          { name: 'unlockRequestedAt', type: 'timestamptz', isNullable: true },
          { name: 'unlockRequestedBy', type: 'uuid', isNullable: true },
          { name: 'unlockReason', type: 'text', isNullable: true },
          { name: 'bookedTotal', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'paidTotal', type: 'decimal', precision: 15, scale: 2, default: 0 },
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

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_INVOICE_JMC"
      ON site_invoices("jmcId")
      WHERE "deletedAt" IS NULL
    `);
    await queryRunner.createIndex(
      'site_invoices',
      new TableIndex({ name: 'IDX_INVOICE_REPORT', columnNames: ['reportId'] }),
    );
    await queryRunner.createIndex(
      'site_invoices',
      new TableIndex({ name: 'IDX_INVOICE_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'site_invoices',
      new TableIndex({ name: 'IDX_INVOICE_PARTY_TYPE', columnNames: ['partyType'] }),
    );
    await queryRunner.createIndex(
      'site_invoices',
      new TableIndex({ name: 'IDX_INVOICE_PO', columnNames: ['poId'] }),
    );
    await queryRunner.createIndex(
      'site_invoices',
      new TableIndex({ name: 'IDX_INVOICE_APPROVAL_STATUS', columnNames: ['approvalStatus'] }),
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_INVOICE_LISTING" ON site_invoices("siteId", "partyType", "approvalStatus")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE site_invoices
      ADD CONSTRAINT chk_invoice_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE site_invoices
      ADD CONSTRAINT chk_invoice_amount CHECK ("totalAmount" = "taxableAmount" + "gstAmount")
    `);

    for (const [col, ref, action] of [
      ['jmcId', 'jmcs', 'RESTRICT'],
      ['reportId', 'site_reports', 'RESTRICT'],
      ['siteId', 'sites', 'RESTRICT'],
      ['poId', 'purchase_orders', 'RESTRICT'],
      ['contractorId', 'contractors', 'RESTRICT'],
      ['vendorId', 'vendors', 'RESTRICT'],
    ] as const) {
      await queryRunner.createForeignKey(
        'site_invoices',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: ref,
          onDelete: action,
        }),
      );
    }
    for (const col of ['createdBy', 'updatedBy', 'deletedBy', 'approvalBy', 'unlockRequestedBy']) {
      await queryRunner.createForeignKey(
        'site_invoices',
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
    const table = await queryRunner.getTable('site_invoices');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('site_invoices', fk);
      }
    }
    await queryRunner.dropTable('site_invoices');
  }
}
