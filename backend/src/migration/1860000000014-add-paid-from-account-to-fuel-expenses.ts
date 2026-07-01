import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidFromAccountToFuelExpenses1860000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ADD COLUMN IF NOT EXISTS "paidFromAccountId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "fuel_expenses"
        ADD CONSTRAINT "FK_fuel_expenses_paidFromAccount" FOREIGN KEY ("paidFromAccountId")
        REFERENCES "company_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_fuel_expense_paidFromAccountId" ON "fuel_expenses" ("paidFromAccountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fuel_expense_paidFromAccountId"`);
    await queryRunner.query(
      `ALTER TABLE "fuel_expenses" DROP CONSTRAINT IF EXISTS "FK_fuel_expenses_paidFromAccount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "fuel_expenses" DROP COLUMN IF EXISTS "paidFromAccountId"`,
    );
  }
}
