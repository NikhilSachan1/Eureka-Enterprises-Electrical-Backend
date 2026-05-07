import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePaymentAdvicesTable1832000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_advices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'bankTransferId', type: 'uuid' },
          { name: 'siteId', type: 'uuid' },
          { name: 'vendorId', type: 'uuid' },
          { name: 'referenceNumber', type: 'varchar', length: '50' },
          { name: 'financialYear', type: 'varchar', length: '10' },
          { name: 'sequenceNumber', type: 'integer' },
          { name: 'generatedAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'pdfKey', type: 'varchar', length: '500', isNullable: true },
          { name: 'approvalStatus', type: 'varchar', length: '20', default: "'APPROVED'" },
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
      'payment_advices',
      new TableIndex({
        name: 'IDX_PAYMENT_ADVICE_BANK_TRANSFER',
        columnNames: ['bankTransferId'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'payment_advices',
      new TableIndex({ name: 'IDX_PAYMENT_ADVICE_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'payment_advices',
      new TableIndex({ name: 'IDX_PAYMENT_ADVICE_VENDOR', columnNames: ['vendorId'] }),
    );
    await queryRunner.createIndex(
      'payment_advices',
      new TableIndex({ name: 'IDX_PAYMENT_ADVICE_FINANCIAL_YEAR', columnNames: ['financialYear'] }),
    );
    await queryRunner.createIndex(
      'payment_advices',
      new TableIndex({
        name: 'IDX_PAYMENT_ADVICE_REFERENCE',
        columnNames: ['referenceNumber'],
        isUnique: true,
      }),
    );

    // bank_transfers is partitioned by RANGE (financialYear), so its primary
    // key is the composite (id, financialYear). Postgres requires a FK to
    // match an existing UNIQUE/PK constraint on the referenced table — a
    // plain `REFERENCES bank_transfers(id)` is rejected with
    // "no unique constraint matching given keys for referenced table".
    // The composite FK below references the actual PK of the partitioned
    // table; this also gives the planner the partition key at JOIN time.
    await queryRunner.createForeignKey(
      'payment_advices',
      new TableForeignKey({
        columnNames: ['bankTransferId', 'financialYear'],
        referencedColumnNames: ['id', 'financialYear'],
        referencedTableName: 'bank_transfers',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'payment_advices',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'payment_advices',
      new TableForeignKey({
        columnNames: ['vendorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vendors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy']) {
      await queryRunner.createForeignKey(
        'payment_advices',
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
    const table = await queryRunner.getTable('payment_advices');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('payment_advices', fk);
      }
    }
    await queryRunner.dropTable('payment_advices');
  }
}
