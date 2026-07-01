import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidFromAccountToBankTransfers1860000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bank_transfers" ADD COLUMN IF NOT EXISTS "paidFromAccountId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "bank_transfers"
        ADD CONSTRAINT "FK_bank_transfers_paidFromAccount" FOREIGN KEY ("paidFromAccountId")
        REFERENCES "company_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_BANK_TRANSFER_PAID_FROM_ACCOUNT" ON "bank_transfers" ("paidFromAccountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_BANK_TRANSFER_PAID_FROM_ACCOUNT"`);
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP CONSTRAINT IF EXISTS "FK_bank_transfers_paidFromAccount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transfers" DROP COLUMN IF EXISTS "paidFromAccountId"`,
    );
  }
}
