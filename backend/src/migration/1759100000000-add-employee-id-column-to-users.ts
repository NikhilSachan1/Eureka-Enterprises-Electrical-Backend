import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddEmployeeIdColumnToUsers1759100000000 implements MigrationInterface {
  name = 'AddEmployeeIdColumnToUsers1759100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add employeeId column to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'employeeId',
        type: 'varchar',
        length: '50',
        isNullable: true,
        isUnique: true,
      }),
    );

    // Create index for employeeId column
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USER_EMPLOYEE_ID',
        columnNames: ['employeeId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.dropIndex('users', 'IDX_USER_EMPLOYEE_ID');

    // Remove employeeId column
    await queryRunner.dropColumn('users', 'employeeId');
  }
}
