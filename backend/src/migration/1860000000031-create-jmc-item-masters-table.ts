import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * JMC system-generated enhancement (3/3).
 *
 * `jmc_item_masters` — global item-name suggestion master (name only). Grows as items are
 * saved anywhere in the system; feeds the typeahead. Case-insensitive uniqueness via a
 * LOWER(name) unique index.
 */
export class CreateJmcItemMastersTable1860000000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jmc_item_masters',
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

    // Case-insensitive uniqueness so "Cement" and "cement" don't both appear as suggestions.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_JMC_ITEM_MASTERS_NAME_LOWER" ON "jmc_item_masters" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('jmc_item_masters', true);
  }
}
