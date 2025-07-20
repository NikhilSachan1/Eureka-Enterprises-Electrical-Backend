import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLeaveApplicationTypeInLeaveApplicationTable1752805662223
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'leave_applications',
      new TableColumn({
        name: 'leaveApplicationType',
        type: 'text',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('leave_applications', 'leaveApplicationType');
  }
}
