import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIseditableIsdeletableColumnInPermissionTable1752397596636
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'permissions',
      new TableColumn({
        name: 'isEditable',
        type: 'boolean',
        default: false,
      }),
    );
    await queryRunner.addColumn(
      'permissions',
      new TableColumn({
        name: 'isDeletable',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('permission', 'isEditable');
    await queryRunner.dropColumn('permission', 'isDeletable');
  }
}
