import { MigrationInterface, QueryRunner } from 'typeorm';

export class LeaveBalanceUniqueConstraint1821000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Delete duplicate rows — keep the row with the highest totalAllocated
    // For ties, keep the most recently created row
    await queryRunner.query(`
      DELETE FROM leave_balances
      WHERE id NOT IN (
        SELECT DISTINCT ON ("userId", "leaveCategory", "financialYear") id
        FROM leave_balances
        WHERE "deletedAt" IS NULL
        ORDER BY "userId", "leaveCategory", "financialYear",
                 "totalAllocated"::numeric DESC,
                 "createdAt" DESC
      )
      AND "deletedAt" IS NULL
    `);

    // Step 2: Add unique constraint to prevent future duplicates
    await queryRunner.query(`
      ALTER TABLE leave_balances
      ADD CONSTRAINT "UQ_LEAVE_BALANCE_USER_CATEGORY_FY"
      UNIQUE ("userId", "leaveCategory", "financialYear")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE leave_balances
      DROP CONSTRAINT IF EXISTS "UQ_LEAVE_BALANCE_USER_CATEGORY_FY"
    `);
  }
}
