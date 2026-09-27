import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The "No JMC" placeholder.
 *
 * An invoice against a SUPPLY_ITEM PO may be raised without a JMC. `site_invoices.jmcId` is NOT
 * NULL and uniquely indexed, and the invoice takes its site, party, vendor and PO *from* the JMC —
 * so rather than loosening all of that, a "No JMC" is a JMC row that says so.
 *
 * Same shape the codebase already uses for system-generated JMCs (migration `…029` dropped NOT NULL
 * from `fileKey`/`fileName` and added `isSystemGenerated`):
 *
 * - `isNoJmc` — true only for these placeholders. Existing rows default to false.
 * - `jmcNumber` loses NOT NULL, because a No-JMC row has no number to give.
 *
 * `jmcNumber` going nullable matters for more than tidiness: the unique index is
 * `UQ_JMC_PO_NUMBER (poId, jmcNumber) WHERE deletedAt IS NULL`, and Postgres treats NULLs as
 * distinct — so one PO can carry several No-JMC invoices. Storing a generated label instead
 * ("No JMC - 24/09/2026") would collide the second time one was raised on the same PO on the same
 * day. The label is computed from `jmcDate` when it is needed.
 */
export class AlterJmcsAddNoJmc1860000000072 implements MigrationInterface {
  name = 'AlterJmcsAddNoJmc1860000000072';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jmcs" ADD COLUMN IF NOT EXISTS "isNoJmc" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "jmcNumber" DROP NOT NULL`);

    // Only placeholders may be numberless; an ordinary JMC without a number stays impossible.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_jmc_number_required') THEN
          ALTER TABLE "jmcs"
            ADD CONSTRAINT "chk_jmc_number_required"
            CHECK ("isNoJmc" = true OR "jmcNumber" IS NOT NULL);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jmcs" DROP CONSTRAINT IF EXISTS "chk_jmc_number_required"`,
    );
    // Placeholders have no number to restore, so they go before NOT NULL comes back.
    await queryRunner.query(`DELETE FROM "jmcs" WHERE "isNoJmc" = true`);
    await queryRunner.query(`UPDATE "jmcs" SET "jmcNumber" = '' WHERE "jmcNumber" IS NULL`);
    await queryRunner.query(`ALTER TABLE "jmcs" ALTER COLUMN "jmcNumber" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jmcs" DROP COLUMN IF EXISTS "isNoJmc"`);
  }
}
