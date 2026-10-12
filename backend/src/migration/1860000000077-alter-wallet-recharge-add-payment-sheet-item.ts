import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `petro_card_wallet_recharges.paymentSheetItemId` — the payment sheet line this recharge came from.
 *
 * A recharge now has two possible origins:
 *   - a paid Payment Sheet line  → this column is set, and the row is read-only
 *   - a manual correction        → NULL, and the row stays editable through the wallet CRUD
 *
 * The column is what enforces "once paid it cannot be reverted": a payment sheet item is already
 * terminal once PAID (pay/hold/reject all require PENDING), so without this the wallet's own
 * delete endpoint would be a back door around that rule.
 *
 * UNIQUE because one paid line credits the wallet exactly once — it is also what makes crediting
 * idempotent if the pay step is ever retried.
 *
 * Deliberately no FK ON DELETE CASCADE: a payment sheet item is soft-deleted, never removed, and
 * cascading would silently take money out of the wallet.
 */
export class AlterWalletRechargeAddPaymentSheetItem1860000000077 implements MigrationInterface {
  name = 'AlterWalletRechargeAddPaymentSheetItem1860000000077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "petro_card_wallet_recharges"
         ADD COLUMN IF NOT EXISTS "paymentSheetItemId" uuid`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_wallet_recharge_sheet_item') THEN
          ALTER TABLE "petro_card_wallet_recharges"
            ADD CONSTRAINT "fk_wallet_recharge_sheet_item"
            FOREIGN KEY ("paymentSheetItemId") REFERENCES "payment_sheet_items"("id");
        END IF;
      END $$;
    `);

    // Partial: many manual recharges carry NULL, and NULLs must not collide with each other.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_wallet_recharge_sheet_item"
        ON "petro_card_wallet_recharges" ("paymentSheetItemId")
        WHERE "paymentSheetItemId" IS NOT NULL AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_wallet_recharge_sheet_item"`);
    await queryRunner.query(
      `ALTER TABLE "petro_card_wallet_recharges" DROP CONSTRAINT IF EXISTS "fk_wallet_recharge_sheet_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "petro_card_wallet_recharges" DROP COLUMN IF EXISTS "paymentSheetItemId"`,
    );
  }
}
