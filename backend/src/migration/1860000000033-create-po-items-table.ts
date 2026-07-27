import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * PO system-generated enhancement (2/4).
 * `po_items` — line items of a system-generated PO: item, HSN, make, quantity (numeric), rate,
 * amount. Ordered by sortOrder. Cascades on PO delete. quantity numeric so a future
 * material-consumption feature can compute remaining stock without a model change.
 */
export class CreatePoItemsTable1860000000033 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'po_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'poId', type: 'uuid' },
          { name: 'itemName', type: 'varchar', length: '255' },
          { name: 'hsnCode', type: 'varchar', length: '20', isNullable: true },
          { name: 'make', type: 'varchar', length: '255', isNullable: true },
          { name: 'quantity', type: 'numeric', precision: 15, scale: 3, default: 0 },
          { name: 'rate', type: 'numeric', precision: 15, scale: 2, default: 0 },
          { name: 'amount', type: 'numeric', precision: 15, scale: 2, default: 0 },
          { name: 'sortOrder', type: 'integer', default: 0 },
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
      'po_items',
      new TableIndex({ name: 'IDX_PO_ITEMS_PO_ID', columnNames: ['poId'] }),
    );

    await queryRunner.createForeignKey(
      'po_items',
      new TableForeignKey({
        name: 'FK_PO_ITEMS_PO',
        columnNames: ['poId'],
        referencedTableName: 'purchase_orders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('po_items', true);
  }
}
