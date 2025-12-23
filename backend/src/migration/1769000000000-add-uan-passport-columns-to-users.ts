import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUanPassportColumnsToUsers1769000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'uanNumber',
        type: 'varchar',
        length: '12',
        isNullable: true,
      }),
      new TableColumn({
        name: 'passportNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'uanNumber');
    await queryRunner.dropColumn('users', 'passportNumber');
  }
}
