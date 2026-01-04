import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserExitFields1793000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'exitDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'exitReason',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'lastWorkingDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'exitRemarks',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'noticePeriodWaived',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    ]);

    await queryRunner.query(
      `CREATE INDEX "IDX_USER_EXIT_DATE" ON "users" ("exitDate") WHERE "exitDate" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_USER_EXIT_DATE"`);
    await queryRunner.dropColumn('users', 'noticePeriodWaived');
    await queryRunner.dropColumn('users', 'exitRemarks');
    await queryRunner.dropColumn('users', 'lastWorkingDate');
    await queryRunner.dropColumn('users', 'exitReason');
    await queryRunner.dropColumn('users', 'exitDate');
  }
}
