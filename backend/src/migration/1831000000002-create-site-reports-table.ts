import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSiteReportsTable1831000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'site_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'jmcId', type: 'uuid' },
          { name: 'siteId', type: 'uuid' },
          { name: 'partyType', type: 'varchar', length: '20' },
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'vendorId', type: 'uuid', isNullable: true },
          { name: 'reportNumber', type: 'varchar', length: '100' },
          { name: 'reportDate', type: 'date' },
          { name: 'fileKey', type: 'varchar', length: '500' },
          { name: 'fileName', type: 'varchar', length: '255' },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'APPROVED'" },
          { name: 'approvalBy', type: 'uuid', isNullable: true },
          { name: 'approvalAt', type: 'timestamptz', isNullable: true },
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

    // 1 JMC = 1 Report — unique partial index on jmcId
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_REPORT_JMC"
      ON site_reports("jmcId")
      WHERE "deletedAt" IS NULL
    `);
    await queryRunner.createIndex(
      'site_reports',
      new TableIndex({ name: 'IDX_REPORT_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'site_reports',
      new TableIndex({ name: 'IDX_REPORT_PARTY_TYPE', columnNames: ['partyType'] }),
    );

    await queryRunner.query(`
      ALTER TABLE site_reports
      ADD CONSTRAINT chk_report_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);

    await queryRunner.createForeignKey(
      'site_reports',
      new TableForeignKey({
        columnNames: ['jmcId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'jmcs',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'site_reports',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'site_reports',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'site_reports',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy', 'approvalBy']) {
      await queryRunner.createForeignKey(
        'site_reports',
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
    const table = await queryRunner.getTable('site_reports');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('site_reports', fk);
      }
    }
    await queryRunner.dropTable('site_reports');
  }
}
