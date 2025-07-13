import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIseditableIsdeletableColumnInRoleTable1752397863526 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'roles',
      new TableColumn({
        name: 'isEditable',
        type: 'boolean',
        default: false,
      }),
    );
    await queryRunner.addColumn(
      'roles',
      new TableColumn({
        name: 'isDeletable',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('roles', 'isEditable');
    await queryRunner.dropColumn('roles', 'isDeletable');
  }
}
