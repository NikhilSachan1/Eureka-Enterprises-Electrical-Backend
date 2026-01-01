import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddHolidayWorkToPayroll1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payroll',
      new TableColumn({
        name: 'holidaysWorked',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'payroll',
      new TableColumn({
        name: 'holidayBonus',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('payroll', 'holidayBonus');
    await queryRunner.dropColumn('payroll', 'holidaysWorked');
  }
}
