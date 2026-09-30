import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `petro_card_wallet_recharges` — money put into the one common PetroCard wallet.
 *
 * This is the **only** wallet table. There is no balance column and no wallet row, because the
 * balance is derived on read:
 *
 *   SUM(active recharges) − SUM(petro-card fuel entries that are live and pending-or-approved)
 *
 * A fuel expense is versioned and its status can move in both directions
 * (PENDING → APPROVED → REJECTED → APPROVED), so eleven different code paths change what a fuel
 * entry consumes. A stored counter would need a correct adjustment in every one of them, and a
 * missed one would be silently wrong about money. Deriving collapses all eleven into one WHERE
 * clause, and "restore on reject" stops being code anyone has to remember.
 *
 * Recharges only ever add: there is no manual debit, by design. Correcting a mistake means editing
 * or deleting the recharge row, which moves the balance by itself because the row leaves the SUM.
 */
export class CreatePetroCardWalletRecharges1860000000074 implements MigrationInterface {
  name = 'CreatePetroCardWalletRecharges1860000000074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "petro_card_wallet_recharges" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "amount"            decimal(12,2) NOT NULL,
        "rechargeDate"      timestamp     NOT NULL,
        "referenceNumber"   varchar(100),
        "paymentMode"       varchar(30),
        "paidFromAccountId" uuid,
        "remarks"           text,
        "createdBy"         uuid,
        "updatedBy"         uuid,
        "deletedBy"         uuid,
        "createdAt"         timestamp NOT NULL DEFAULT NOW(),
        "updatedAt"         timestamp NOT NULL DEFAULT NOW(),
        "deletedAt"         timestamp
      )
    `);

    // A recharge adds money. A negative or zero one would be a manual debit through the back door,
    // which is exactly what the requirement asked us not to build.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_petro_card_recharge_amount') THEN
          ALTER TABLE "petro_card_wallet_recharges"
            ADD CONSTRAINT "chk_petro_card_recharge_amount" CHECK ("amount" > 0);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_petro_card_recharge_paid_from') THEN
          ALTER TABLE "petro_card_wallet_recharges"
            ADD CONSTRAINT "fk_petro_card_recharge_paid_from"
            FOREIGN KEY ("paidFromAccountId") REFERENCES "company_bank_accounts"("id");
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_petro_card_recharge_date"
         ON "petro_card_wallet_recharges" ("rechargeDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_petro_card_recharge_deleted_at"
         ON "petro_card_wallet_recharges" ("deletedAt")`,
    );

    // The balance sums live petro-card fuel entries on every read and on every insufficient-balance
    // check. Without this the aggregate scans the whole fuel table.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fuel_expense_wallet_consumption"
        ON "fuel_expenses" ("transactionType", "approvalStatus")
        WHERE "isActive" = true AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fuel_expense_wallet_consumption"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "petro_card_wallet_recharges"`);
  }
}
