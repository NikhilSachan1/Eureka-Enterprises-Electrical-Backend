import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modify gst_payments to support both SALE and PURCHASE sides.
 * - Add partyType column (default 'PURCHASE' for existing rows)
 * - Add contractorId column (nullable, for SALE side)
 * - Make vendorId nullable (SALE entries have no vendorId)
 */
export class GstPaymentsSupportBothSides1844000000000 implements MigrationInterface {
  name = 'GstPaymentsSupportBothSides1844000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Make vendorId nullable
    await queryRunner.query(`
      ALTER TABLE "gst_payments"
      ALTER COLUMN "vendorId" DROP NOT NULL
    `);

    // 2. Add partyType column (backfill existing rows as PURCHASE)
    await queryRunner.query(`
      ALTER TABLE "gst_payments"
      ADD COLUMN IF NOT EXISTS "partyType" VARCHAR(20) NOT NULL DEFAULT 'PURCHASE'
    `);

    // 3. Add contractorId column (nullable, for SALE side)
    await queryRunner.query(`
      ALTER TABLE "gst_payments"
      ADD COLUMN IF NOT EXISTS "contractorId" UUID NULL
    `);

    // 4. Add indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_GST_PAYMENT_CONTRACTOR" ON "gst_payments" ("contractorId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_GST_PAYMENT_PARTY_TYPE" ON "gst_payments" ("partyType")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_GST_PAYMENT_PARTY_TYPE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_GST_PAYMENT_CONTRACTOR"`);
    await queryRunner.query(`ALTER TABLE "gst_payments" DROP COLUMN IF EXISTS "contractorId"`);
    await queryRunner.query(`ALTER TABLE "gst_payments" DROP COLUMN IF EXISTS "partyType"`);
    await queryRunner.query(`
      ALTER TABLE "gst_payments"
      ALTER COLUMN "vendorId" SET NOT NULL
    `);
  }
}
