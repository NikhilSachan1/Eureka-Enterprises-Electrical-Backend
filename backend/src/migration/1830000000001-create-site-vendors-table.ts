import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSiteVendorsTable1830000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'site_vendors',
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
          { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'site_vendors',
      new TableIndex({ name: 'IDX_SITE_VENDOR_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'site_vendors',
      new TableIndex({ name: 'IDX_SITE_VENDOR_VENDOR', columnNames: ['vendorId'] }),
    );
    await queryRunner.createIndex(
      'site_vendors',
      new TableIndex({
        name: 'IDX_SITE_VENDOR_UNIQUE',
        columnNames: ['siteId', 'vendorId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'site_vendors',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'site_vendors',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('site_vendors');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('site_vendors', fk);
      }
    }
    await queryRunner.dropTable('site_vendors');
  }
}
