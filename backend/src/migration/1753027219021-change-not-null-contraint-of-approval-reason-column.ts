import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ChangeNotNullContraintOfApprovalReasonColumn1753027219021
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'leave_applications',
      'approvalReason',
      new TableColumn({
        name: 'approvalReason',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'leave_applications',
      'approvalReason',
      new TableColumn({
        name: 'approvalReason',
        type: 'varchar',
        isNullable: false,
      }),
    );
  }
}
