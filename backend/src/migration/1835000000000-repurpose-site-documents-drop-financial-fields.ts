import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Repurpose site_documents table
 * 
 * This migration removes financial-specific columns and indexes from the site_documents table.
 * Financial document tracking has been moved to dedicated modules:
 * - purchase_orders, site_invoices, book_payments, bank_transfers, payment_advices, etc.
 * 
 * The site_documents table is now repurposed for non-financial documents like:
 * - Contracts, work orders, completion certificates
 * - Photos, inspection reports, etc.
 * 
 * Changes:
 * 1. Add vendorId column for vendor-related non-financial documents
 * 2. Drop financial-specific indexes
 * 3. Drop financial-specific columns (direction, gstAmount, totalAmount, paymentStatus, paymentDate, paymentReference, dueDate)
 * 4. Make amount column nullable (kept for informational "rough quote" purposes only)
 * 5. Add index on vendorId
 */
export class RepurposeSiteDocumentsDropFinancialFields1835000000000
  implements MigrationInterface
{
  name = 'RepurposeSiteDocumentsDropFinancialFields1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add vendorId column for vendor-related documents
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "vendorId" uuid NULL
    `);

    // Step 2: Add foreign key constraint for vendorId
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD CONSTRAINT "FK_site_documents_vendor"
      FOREIGN KEY ("vendorId")
      REFERENCES "vendors"("id")
      ON DELETE SET NULL
    `);

    // Step 3: Add index on vendorId
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SITE_DOCUMENT_VENDOR"
      ON "site_documents" ("vendorId")
    `);

    // Step 4: Drop financial-specific indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_SITE_DOCUMENT_DIRECTION"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_SITE_DOCUMENT_PAYMENT_STATUS"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_SITE_DOCUMENT_DUE_DATE"
    `);

    // Step 5: Drop financial-specific columns
    // Note: We drop these columns because financial tracking is now in dedicated modules
    
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "direction"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "gstAmount"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "totalAmount"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "paymentStatus"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "paymentDate"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "paymentReference"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "dueDate"
    `);

    // Step 6: Make amount column nullable (keep for informational purposes)
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ALTER COLUMN "amount" DROP NOT NULL,
      ALTER COLUMN "amount" DROP DEFAULT
    `);

    // Step 7: Update amount column to nullable if it has a default
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ALTER COLUMN "amount" TYPE decimal(15, 2) USING amount::decimal(15, 2)
    `);

    // Step 8: Add comment to table documenting the repurposing
    await queryRunner.query(`
      COMMENT ON TABLE "site_documents" IS 
      'Repurposed for non-financial documents only. Financial documents (PO, Invoice) are now in dedicated modules: purchase_orders, site_invoices, etc.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove table comment
    await queryRunner.query(`
      COMMENT ON TABLE "site_documents" IS NULL
    `);

    // Restore amount column with default
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ALTER COLUMN "amount" SET DEFAULT 0,
      ALTER COLUMN "amount" SET NOT NULL
    `);

    // Re-add financial columns
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "direction" varchar(20) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "gstAmount" decimal(15, 2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "totalAmount" decimal(15, 2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "paymentStatus" varchar(20) NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "paymentDate" date NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "paymentReference" varchar(255) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      ADD COLUMN IF NOT EXISTS "dueDate" date NULL
    `);

    // Re-create financial indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SITE_DOCUMENT_DIRECTION"
      ON "site_documents" ("direction")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SITE_DOCUMENT_PAYMENT_STATUS"
      ON "site_documents" ("paymentStatus")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SITE_DOCUMENT_DUE_DATE"
      ON "site_documents" ("dueDate")
    `);

    // Drop vendor index and foreign key
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_SITE_DOCUMENT_VENDOR"
    `);

    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP CONSTRAINT IF EXISTS "FK_site_documents_vendor"
    `);

    // Drop vendorId column
    await queryRunner.query(`
      ALTER TABLE "site_documents"
      DROP COLUMN IF EXISTS "vendorId"
    `);
  }
}
