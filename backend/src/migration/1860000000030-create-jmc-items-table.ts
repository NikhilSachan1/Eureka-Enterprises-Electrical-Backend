import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * JMC system-generated enhancement (2/3).
 *
 * `jmc_items` — line items of a system-generated JMC. Each row: item name, unit, quantity
 * (unit & quantity are free text per requirement). Ordered by `sortOrder`. Cascades on JMC delete.
 */
export class CreateJmcItemsTable1860000000030 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jmc_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'jmcId', type: 'uuid' },
          { name: 'itemName', type: 'varchar', length: '255' },
          { name: 'unit', type: 'varchar', length: '100' },
          { name: 'quantity', type: 'varchar', length: '100' },
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
      'jmc_items',
      new TableIndex({ name: 'IDX_JMC_ITEMS_JMC_ID', columnNames: ['jmcId'] }),
    );

    await queryRunner.createForeignKey(
      'jmc_items',
      new TableForeignKey({
        name: 'FK_JMC_ITEMS_JMC',
        columnNames: ['jmcId'],
        referencedTableName: 'jmcs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('jmc_items', true);
  }
}
