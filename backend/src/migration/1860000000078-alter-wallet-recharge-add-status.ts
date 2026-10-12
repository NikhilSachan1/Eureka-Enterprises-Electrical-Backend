import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `petro_card_wallet_recharges.status` — PENDING until the money is actually paid.
 *
 * The wallet had two doors into it: a Payment Sheet line, which credits on payment, and the
 * wallet screen's own "Record Recharge", which credited the moment the row was written. The
 * second one let a balance appear against a payment nobody had made.
 *
 * With this column there is one door. A recharge is *raised* on the wallet screen as PENDING,
 * shows up as outstanding, is picked onto a Payment Sheet, and only the pay step flips it to
 * PAID. The balance counts PAID rows and nothing else, so it cannot move ahead of a payment.
 *
 * Backfill: anything that came off a paid sheet line is PAID; everything else was raised through
 * the old instant-credit door and has no payment behind it, so it becomes PENDING. On dev that
 * is the ₹852 row the balance was wrongly showing — it drops out of the balance and reappears as
 * outstanding, which is where it should have been all along.
 */
export class AlterWalletRechargeAddStatus1860000000078 implements MigrationInterface {
  name = 'AlterWalletRechargeAddStatus1860000000078';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "petro_card_wallet_recharges"
        ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE "petro_card_wallet_recharges"
        DROP CONSTRAINT IF EXISTS "chk_wallet_recharge_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "petro_card_wallet_recharges"
        ADD CONSTRAINT "chk_wallet_recharge_status"
        CHECK ("status" IN ('PENDING', 'PAID'))
    `);

    await queryRunner.query(`
      UPDATE "petro_card_wallet_recharges"
         SET "status" = CASE WHEN "paymentSheetItemId" IS NOT NULL THEN 'PAID' ELSE 'PENDING' END
    `);

    // The balance sums PAID rows; outstanding reads PENDING ones. Both filter on this column.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_wallet_recharge_status"
        ON "petro_card_wallet_recharges" ("status")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_wallet_recharge_status"`);
    await queryRunner.query(
      `ALTER TABLE "petro_card_wallet_recharges" DROP CONSTRAINT IF EXISTS "chk_wallet_recharge_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "petro_card_wallet_recharges" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
