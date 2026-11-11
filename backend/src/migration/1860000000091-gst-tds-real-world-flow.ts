import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align the GST / TDS registers with how the taxes actually work.
 *
 * GST
 *  - A register entry now carries an `isGstHold` snapshot of its invoice. Only a HELD amount is
 *    settled through the GST register (released to the vendor / received from the client).
 *    When GST was not held it moved with the invoice payment itself, so there is nothing to
 *    settle — releasing it again would record the same GST twice.
 *  - Portal verification (GSTR-2B / GSTR-1 match) is required for every entry, held or not.
 *    Entries that were auto-verified on approval (hold OFF, never touched by a user, not
 *    settled) go back to pending so someone actually checks the portal.
 *  - Settlements are entry-wise, so the "one payment per site / vendor / month" index is wrong:
 *    a second release in the same month failed with a unique violation. It is dropped.
 *  - The payment-advice reference is only meaningful when we pay a vendor; a receipt from a
 *    client has none, so the column becomes nullable.
 *
 * TDS
 *  - Purchase side: we deduct and deposit via challan (BSR code + challan serial no.). One
 *    challan can cover several vendors, so the per-vendor CHECK is relaxed for PURCHASE and the
 *    per-month unique indexes are dropped. UTR becomes optional — a challan has no UTR.
 */
export class GstTdsRealWorldFlow1860000000091 implements MigrationInterface {
  name = 'GstTdsRealWorldFlow1860000000091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── GST register ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE gst_register_entries
        ADD COLUMN IF NOT EXISTS "isGstHold" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      UPDATE gst_register_entries g
         SET "isGstHold" = inv."isGstHold"
        FROM site_invoices inv
       WHERE inv.id = g."invoiceId"
    `);
    // Auto-verified on approval (no user ever verified it) and not settled → needs a real check.
    await queryRunner.query(`
      UPDATE gst_register_entries
         SET "isVerified" = false,
             "verifiedAt" = NULL
       WHERE "isGstHold" = false
         AND "isVerified" = true
         AND "verifiedBy" IS NULL
         AND "gstPaymentId" IS NULL
    `);

    // ── GST payments (settlements) ────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_GST_PAYMENT_SITE_VENDOR_MONTH"`);
    await queryRunner.query(`
      ALTER TABLE gst_payments
        ALTER COLUMN "paymentAdviceReferenceNumber" DROP NOT NULL
    `);

    // ── TDS payments (challans) ───────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_TDS_PAYMENT_SALE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_TDS_PAYMENT_PURCHASE"`);
    await queryRunner.query(`
      ALTER TABLE tds_payments
        ADD COLUMN IF NOT EXISTS "bsrCode" varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS "challanSerialNumber" varchar(20) NULL,
        ALTER COLUMN "utrNumber" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tds_payments DROP CONSTRAINT IF EXISTS chk_tds_payment_party
    `);
    await queryRunner.query(`
      ALTER TABLE tds_payments
      ADD CONSTRAINT chk_tds_payment_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "contractorId" IS NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tds_payments DROP CONSTRAINT IF EXISTS chk_tds_payment_party
    `);
    await queryRunner.query(`
      ALTER TABLE tds_payments
      ADD CONSTRAINT chk_tds_payment_party CHECK (
        ("partyType" = 'SALE' AND "contractorId" IS NOT NULL AND "vendorId" IS NULL)
        OR ("partyType" = 'PURCHASE' AND "vendorId" IS NOT NULL AND "contractorId" IS NULL)
      )
    `);
    await queryRunner.query(
      `UPDATE tds_payments SET "utrNumber" = COALESCE("utrNumber", "challanSerialNumber", '')`,
    );
    await queryRunner.query(`
      ALTER TABLE tds_payments
        ALTER COLUMN "utrNumber" SET NOT NULL,
        DROP COLUMN IF EXISTS "challanSerialNumber",
        DROP COLUMN IF EXISTS "bsrCode"
    `);

    await queryRunner.query(`
      UPDATE gst_payments SET "paymentAdviceReferenceNumber" = '' WHERE "paymentAdviceReferenceNumber" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE gst_payments
        ALTER COLUMN "paymentAdviceReferenceNumber" SET NOT NULL
    `);

    // Unique indexes are not restored: entry-wise settlements may legitimately have created
    // several rows per month, which the old indexes would reject.

    await queryRunner.query(`
      UPDATE gst_register_entries
         SET "isVerified" = true, "verifiedAt" = COALESCE("verifiedAt", NOW())
       WHERE "isGstHold" = false AND "isVerified" = false AND "verifiedBy" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE gst_register_entries DROP COLUMN IF EXISTS "isGstHold"`);
  }
}
