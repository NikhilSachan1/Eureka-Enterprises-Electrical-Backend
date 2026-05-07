import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateDebitNotesTable1833000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'debit_notes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'siteId', type: 'uuid' },
          { name: 'contractorId', type: 'uuid' },
          { name: 'amount', type: 'decimal', precision: 15, scale: 2 },
          { name: 'noteDate', type: 'date' },
          { name: 'fileKey', type: 'varchar', length: '500' },
          { name: 'fileName', type: 'varchar', length: '255' },
          { name: 'remarks', type: 'text', isNullable: true },
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
      'debit_notes',
      new TableIndex({ name: 'IDX_DEBIT_NOTE_SITE', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'debit_notes',
      new TableIndex({ name: 'IDX_DEBIT_NOTE_CONTRACTOR', columnNames: ['contractorId'] }),
    );

    await queryRunner.createForeignKey(
      'debit_notes',
      new TableForeignKey({
        columnNames: ['siteId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'sites',
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createForeignKey(
      'debit_notes',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'RESTRICT',
      }),
    );
    for (const col of ['createdBy', 'updatedBy', 'deletedBy']) {
      await queryRunner.createForeignKey(
        'debit_notes',
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
    const table = await queryRunner.getTable('debit_notes');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('debit_notes', fk);
      }
    }
    await queryRunner.dropTable('debit_notes');
  }
}
