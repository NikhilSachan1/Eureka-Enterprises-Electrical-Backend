import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEntrySourceTypeInLeaveApplicationTable1752979640206 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'leave_applications',
      new TableColumn({
        name: 'entrySourceType',
        type: 'text',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'leave_applications',
      new TableColumn({
        name: 'leaveCategory',
        type: 'varchar',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('leave_applications', 'entrySourceType');
    await queryRunner.dropColumn('leave_applications', 'leaveCategory');
  }
}
