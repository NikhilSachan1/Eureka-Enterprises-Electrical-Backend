import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * PO system-generated enhancement (3/4).
 * `po_item_masters` — global PO item-name suggestion master (separate from JMC's, since PO items
 * are materials, not measurement work-items). Case-insensitive uniqueness via LOWER(name).
 */
export class CreatePoItemMastersTable1860000000034 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'po_item_masters',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '255' },
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

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_PO_ITEM_MASTERS_NAME_LOWER" ON "po_item_masters" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('po_item_masters', true);
  }
}
