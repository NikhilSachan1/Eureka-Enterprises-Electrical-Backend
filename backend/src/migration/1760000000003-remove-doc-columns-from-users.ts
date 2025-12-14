import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveDocColumnsFromUsers1760000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove document columns from users table (now stored in user_documents table)
    await queryRunner.dropColumn('users', 'esicDoc');
    await queryRunner.dropColumn('users', 'aadharDoc');
    await queryRunner.dropColumn('users', 'panDoc');
    await queryRunner.dropColumn('users', 'dlDoc');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add document columns if migration is reverted
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'esicDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'aadharDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'panDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'dlDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }
}
