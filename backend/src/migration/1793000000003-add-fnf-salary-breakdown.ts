import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFnfSalaryBreakdown1793000000003 implements MigrationInterface {
  name = 'AddFnfSalaryBreakdown1793000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fnf_settlements',
      new TableColumn({
        name: 'salaryBreakdown',
        type: 'jsonb',
        isNullable: true,
        comment:
          'Detailed salary breakdown including pro-rated components, deductions, and attendance summary',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fnf_settlements', 'salaryBreakdown');
  }
}
