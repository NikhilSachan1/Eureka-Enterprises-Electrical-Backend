import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimezoneToUsers1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'timezone',
        type: 'varchar',
        length: '50',
        isNullable: false,
        default: "'Asia/Kolkata'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'timezone');
  }
}
