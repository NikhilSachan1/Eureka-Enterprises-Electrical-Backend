import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsActiveColumnInRolePermissionTable1751137921236 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'role_permissions',
      new TableColumn({
        name: 'isActive',
        type: 'boolean',
        default: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('role_permissions', 'isActive');
  }
}
