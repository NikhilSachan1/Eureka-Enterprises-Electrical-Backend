import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePayrollTable1770000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for payroll status
    await queryRunner.query(`
      CREATE TYPE "payroll_status_enum" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'PAID', 'CANCELLED')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'payroll',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid' },
          { name: 'salaryStructureId', type: 'uuid' },
          { name: 'month', type: 'int' },
          { name: 'year', type: 'int' },
          // Attendance Summary
          { name: 'totalDays', type: 'int', default: 0 },
          { name: 'workingDays', type: 'int', default: 0 },
          { name: 'presentDays', type: 'int', default: 0 },
          { name: 'absentDays', type: 'int', default: 0 },
          { name: 'paidLeaveDays', type: 'int', default: 0 },
          { name: 'unpaidLeaveDays', type: 'int', default: 0 },
          { name: 'holidays', type: 'int', default: 0 },
          { name: 'weekoffs', type: 'int', default: 0 },
          // Prorated Earnings
          { name: 'basicProrated', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'hraProrated', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'foodAllowanceProrated', type: 'decimal', precision: 12, scale: 2, default: 0 },
          {
            name: 'conveyanceAllowanceProrated',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'medicalAllowanceProrated',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'specialAllowanceProrated',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          // Deductions
          { name: 'employeePf', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'employerPf', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'tds', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'esic', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'professionalTax', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'lopDeduction', type: 'decimal', precision: 12, scale: 2, default: 0 },
          // Bonus
          { name: 'totalBonus', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'bonusDetails', type: 'jsonb', isNullable: true },
          // Totals
          { name: 'grossEarnings', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'totalDeductions', type: 'decimal', precision: 12, scale: 2, default: 0 },
          { name: 'netPayable', type: 'decimal', precision: 12, scale: 2, default: 0 },
          // Status & Workflow
          { name: 'status', type: 'payroll_status_enum', default: "'DRAFT'" },
          { name: 'generatedAt', type: 'timestamp', isNullable: true },
          { name: 'approvedBy', type: 'uuid', isNullable: true },
          { name: 'approvedAt', type: 'timestamp', isNullable: true },
          { name: 'paidAt', type: 'timestamp', isNullable: true },
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

    // Create unique index for user + month + year
    await queryRunner.createIndex(
      'payroll',
      new TableIndex({
        name: 'IDX_PAYROLL_USER_MONTH_YEAR',
        columnNames: ['userId', 'month', 'year'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'payroll',
      new TableIndex({
        name: 'IDX_PAYROLL_MONTH_YEAR',
        columnNames: ['month', 'year'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'payroll',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'payroll',
      new TableForeignKey({
        columnNames: ['salaryStructureId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'salary_structures',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'payroll',
      new TableForeignKey({
        columnNames: ['approvedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payroll');
    await queryRunner.query(`DROP TYPE "payroll_status_enum"`);
  }
}
