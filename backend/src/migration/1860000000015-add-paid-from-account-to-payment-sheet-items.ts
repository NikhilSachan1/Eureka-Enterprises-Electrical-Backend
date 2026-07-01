import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidFromAccountToPaymentSheetItems1860000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_sheet_items" ADD COLUMN IF NOT EXISTS "paidFromAccountId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_sheet_items"
        ADD CONSTRAINT "FK_ps_items_paidFromAccount" FOREIGN KEY ("paidFromAccountId")
        REFERENCES "company_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_PS_ITEMS_PAID_FROM_ACCOUNT" ON "payment_sheet_items" ("paidFromAccountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PS_ITEMS_PAID_FROM_ACCOUNT"`);
    await queryRunner.query(
      `ALTER TABLE "payment_sheet_items" DROP CONSTRAINT IF EXISTS "FK_ps_items_paidFromAccount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_sheet_items" DROP COLUMN IF EXISTS "paidFromAccountId"`,
    );
  }
}
