import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFnfPayslipKey1793000000004 implements MigrationInterface {
  name = 'AddFnfPayslipKey1793000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fnf_settlements',
      new TableColumn({
        name: 'payslipKey',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fnf_settlements', 'payslipKey');
  }
}
