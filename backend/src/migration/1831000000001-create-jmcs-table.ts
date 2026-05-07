import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateJmcsTable1831000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'jmcs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'poId', type: 'uuid' },
          { name: 'siteId', type: 'uuid' },
          { name: 'partyType', type: 'varchar', length: '20' },
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'vendorId', type: 'uuid', isNullable: true },
          { name: 'jmcNumber', type: 'varchar', length: '100' },
          { name: 'jmcDate', type: 'date' },
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
      'jmcs',
      new TableIndex({ name: 'IDX_JMC_PO', columnNames: ['poId'] }),
    );
    await queryRunner.createIndex(
      'jmcs',
      new TableIndex({ name: 'IDX_JMC_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'jmcs',
      new TableIndex({ name: 'IDX_JMC_PARTY_TYPE', columnNames: ['partyType'] }),
    );
    await queryRunner.createIndex(
      'jmcs',
      new TableIndex({ name: 'IDX_JMC_APPROVAL_STATUS', columnNames: ['approvalStatus'] }),
    );
    await queryRunner.createIndex(
      'jmcs',
      new TableIndex({ name: 'IDX_JMC_SITE_PARTY', columnNames: ['siteId', 'partyType'] }),
    );

    await queryRunner.query(`
      CREATE INDEX "IDX_JMC_LISTING" ON jmcs("siteId", "partyType", "approvalStatus")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_JMC_PO_NUMBER"
      ON jmcs("poId", "jmcNumber")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE jmcs
      ADD CONSTRAINT chk_jmc_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);

    await queryRunner.createForeignKey(
      'jmcs',
      new TableForeignKey({
        columnNames: ['poId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'purchase_orders',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'jmcs',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'jmcs',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'jmcs',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy', 'approvalBy', 'unlockRequestedBy']) {
      await queryRunner.createForeignKey(
        'jmcs',
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
    const table = await queryRunner.getTable('jmcs');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('jmcs', fk);
      }
    }
    await queryRunner.dropTable('jmcs');
  }
}
