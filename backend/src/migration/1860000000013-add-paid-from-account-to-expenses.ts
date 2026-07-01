import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidFromAccountToExpenses1860000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paidFromAccountId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD CONSTRAINT "FK_expenses_paidFromAccount" FOREIGN KEY ("paidFromAccountId")
        REFERENCES "company_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expenses_paidFromAccountId" ON "expenses" ("paidFromAccountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_expenses_paidFromAccountId"`);
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_paidFromAccount"`,
    );
    await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN IF EXISTS "paidFromAccountId"`);
  }
}
