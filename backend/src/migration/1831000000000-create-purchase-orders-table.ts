import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePurchaseOrdersTable1831000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'purchase_orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'siteId', type: 'uuid' },
          { name: 'partyType', type: 'varchar', length: '20' }, // SALE | PURCHASE
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'vendorId', type: 'uuid', isNullable: true },
          { name: 'poNumber', type: 'varchar', length: '100' },
          { name: 'poDate', type: 'date' },
          { name: 'taxableAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'gstAmount', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'totalAmount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'fileKey', type: 'varchar', length: '500' },
          { name: 'fileName', type: 'varchar', length: '255' },
          { name: 'remarks', type: 'text', isNullable: true },
          // Approval workflow
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'PENDING'" },
          { name: 'approvalBy', type: 'uuid', isNullable: true },
          { name: 'approvalAt', type: 'timestamptz', isNullable: true },
          { name: 'approvalReason', type: 'text', isNullable: true },
          // Lock / unlock
          { name: 'isLocked', type: 'boolean', default: false },
          { name: 'unlockRequestedAt', type: 'timestamptz', isNullable: true },
          { name: 'unlockRequestedBy', type: 'uuid', isNullable: true },
          { name: 'unlockReason', type: 'text', isNullable: true },
          // Denormalized rollups
          { name: 'invoicedTotal', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'bookedTotal', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'paidTotal', type: 'decimal', precision: 15, scale: 2, default: 0 },
          { name: 'lastInvoiceAt', type: 'timestamptz', isNullable: true },
          { name: 'lastPaymentAt', type: 'timestamptz', isNullable: true },
          // Audit (BaseEntity)
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
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_PARTY_TYPE', columnNames: ['partyType'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_CONTRACTOR', columnNames: ['contractorId'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_VENDOR', columnNames: ['vendorId'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_NUMBER', columnNames: ['poNumber'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_APPROVAL_STATUS', columnNames: ['approvalStatus'] }),
    );
    await queryRunner.createIndex(
      'purchase_orders',
      new TableIndex({ name: 'IDX_PO_SITE_PARTY', columnNames: ['siteId', 'partyType'] }),
    );

    // Hot-path partial composite index (Plan §3.4 hardening #2)
    await queryRunner.query(`
      CREATE INDEX "IDX_PO_LISTING" ON purchase_orders("siteId", "partyType", "approvalStatus")
      WHERE "deletedAt" IS NULL
    `);

    // Unique partial index (siteId, partyType, poNumber) where deletedAt is null
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_PO_SITE_PARTY_NUMBER"
      ON purchase_orders("siteId", "partyType", "poNumber")
      WHERE "deletedAt" IS NULL
    `);

    // CHECK: partyType ↔ contractorId/vendorId exclusivity (Plan §3.4 hardening #1)
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      ADD CONSTRAINT chk_po_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);

    // CHECK: total = taxable + gst
    await queryRunner.query(`
      ALTER TABLE purchase_orders
      ADD CONSTRAINT chk_po_amount CHECK ("totalAmount" = "taxableAmount" + "gstAmount")
    `);

    // FKs
    await queryRunner.createForeignKey(
      'purchase_orders',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'purchase_orders',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'purchase_orders',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy', 'approvalBy', 'unlockRequestedBy']) {
      await queryRunner.createForeignKey(
        'purchase_orders',
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
    const table = await queryRunner.getTable('purchase_orders');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('purchase_orders', fk);
      }
    }
    await queryRunner.dropTable('purchase_orders');
  }
}
