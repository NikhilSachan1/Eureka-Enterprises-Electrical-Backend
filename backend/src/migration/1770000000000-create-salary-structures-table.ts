import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSalaryStructuresTable1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for increment type
    await queryRunner.query(`
      CREATE TYPE "increment_type_enum" AS ENUM ('INITIAL', 'ANNUAL', 'PROMOTION', 'CORRECTION', 'OTHER')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'salary_structures',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid' },
          // Earnings
          { name: 'basic', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'hra', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'foodAllowance', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'conveyanceAllowance', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'medicalAllowance', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'specialAllowance', type: 'decimal', precision: 12, scale: 2, default: 0 },
          // Deductions
          { name: 'employeePf', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'employerPf', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'tds', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'esic', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'professionalTax', type: 'decimal', precision: 12, scale: 2, default: 0 },
          // Calculated
          { name: 'grossSalary', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'totalDeductions', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'netSalary', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'ctc', type: 'decimal', precision: 12, scale: 2, default: 0 },
          // Effective dates
          { name: 'effectiveFrom', type: 'date' },
          { name: 'effectiveTo', type: 'date', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          // Increment tracking
          {
            name: 'incrementPercentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          { name: 'incrementType', type: 'increment_type_enum', default: "'INITIAL'" },
          { name: 'previousStructureId', type: 'uuid', isNullable: true },
          { name: 'remarks', type: 'text', isNullable: true },
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
      'salary_structures',
      new TableIndex({
        name: 'IDX_SALARY_STRUCTURE_USER_ID',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'salary_structures',
      new TableIndex({
        name: 'IDX_SALARY_STRUCTURE_EFFECTIVE_FROM',
        columnNames: ['effectiveFrom'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'salary_structures',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'salary_structures',
      new TableForeignKey({
        columnNames: ['previousStructureId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'salary_structures',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('salary_structures');
    await queryRunner.query(`DROP TYPE "increment_type_enum"`);
  }
}
