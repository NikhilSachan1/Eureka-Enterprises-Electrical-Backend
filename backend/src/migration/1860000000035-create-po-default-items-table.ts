import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * PO system-generated enhancement (4/4).
 * `po_default_items` — default line items that pre-fill a new PO on the FE. Not editable via API
 * for now; seeded with a single placeholder row here — the team will replace it with the real
 * default items later (directly / via a follow-up migration).
 */
export class CreatePoDefaultItemsTable1860000000035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'po_default_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'itemName', type: 'varchar', length: '255' },
          { name: 'hsnCode', type: 'varchar', length: '20', isNullable: true },
          { name: 'make', type: 'varchar', length: '255', isNullable: true },
          { name: 'sortOrder', type: 'integer', default: 0 },
          { name: 'isActive', type: 'boolean', default: true },
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

    // Single placeholder default item — replace with real defaults later.
    await queryRunner.query(
      `INSERT INTO "po_default_items" ("itemName", "hsnCode", "make", "sortOrder", "isActive")
       VALUES ('Sample Item (replace me)', NULL, NULL, 0, true)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('po_default_items', true);
  }
}
