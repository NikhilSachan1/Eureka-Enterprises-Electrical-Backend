import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The global unique on (userId, month, year) prevented inserting a new payroll row
 * after cancelling the previous one — the CANCELLED row still violated uniqueness.
 *
 * Replace with a partial unique index: only enforce uniqueness when status is not CANCELLED.
 */
export class PayrollPartialUniqueUserMonthYear1817000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAYROLL_USER_MONTH_YEAR"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_PAYROLL_USER_MONTH_YEAR_ACTIVE"
      ON "payroll" ("userId", "month", "year")
      WHERE status <> 'CANCELLED'::payroll_status_enum
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAYROLL_USER_MONTH_YEAR_ACTIVE"`);

    // May fail if both a CANCELLED and a non-CANCELLED row exist for the same user/month/year.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_PAYROLL_USER_MONTH_YEAR"
      ON "payroll" ("userId", "month", "year")
    `);
  }
}
