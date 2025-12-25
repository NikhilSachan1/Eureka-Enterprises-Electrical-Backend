import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLeaveDetailsToPayroll1770000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the columns already exist
    const table = await queryRunner.getTable('payroll');

    if (table && !table.findColumnByName('leaveDetails')) {
      await queryRunner.addColumn(
        'payroll',
        new TableColumn({
          name: 'leaveDetails',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }

    if (table && !table.findColumnByName('halfDays')) {
      await queryRunner.addColumn(
        'payroll',
        new TableColumn({
          name: 'halfDays',
          type: 'decimal',
          precision: 4,
          scale: 1,
          default: 0,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payroll');

    if (table?.findColumnByName('leaveDetails')) {
      await queryRunner.dropColumn('payroll', 'leaveDetails');
    }

    if (table?.findColumnByName('halfDays')) {
      await queryRunner.dropColumn('payroll', 'halfDays');
    }
  }
}
