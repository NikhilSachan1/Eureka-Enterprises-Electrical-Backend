import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExpiredAtToAnnouncements1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'announcements',
      new TableColumn({
        name: 'expiredAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('announcements', 'expiredAt');
  }
}
