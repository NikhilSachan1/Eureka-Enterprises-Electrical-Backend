import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSalaryChangeLogsTable1770000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for change type
    await queryRunner.query(`
      CREATE TYPE "salary_change_type_enum" AS ENUM ('CREATE', 'UPDATE', 'INCREMENT', 'DEACTIVATE')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'salary_change_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'salaryStructureId', type: 'uuid' },
          { name: 'changeType', type: 'salary_change_type_enum' },
          { name: 'previousValues', type: 'jsonb', isNullable: true },
          { name: 'newValues', type: 'jsonb' },
          { name: 'changedBy', type: 'uuid' },
          { name: 'changedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'reason', type: 'text', isNullable: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'salary_change_logs',
      new TableIndex({
        name: 'IDX_SALARY_CHANGE_LOG_STRUCTURE_ID',
        columnNames: ['salaryStructureId'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'salary_change_logs',
      new TableForeignKey({
        columnNames: ['salaryStructureId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'salary_structures',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'salary_change_logs',
      new TableForeignKey({
        columnNames: ['changedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('salary_change_logs');
    await queryRunner.query(`DROP TYPE "salary_change_type_enum"`);
  }
}
