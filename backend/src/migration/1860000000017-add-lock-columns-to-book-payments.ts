import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Book Payments become auto-approved + auto-locked on creation, with a JMC-style
 * unlock workflow. Adds the lock/unlock tracking columns and backfills existing
 * APPROVED rows to isLocked=true so they can use the new unlock flow. Existing
 * PENDING rows are left untouched.
 */
export class AddLockColumnsToBookPayments1860000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book_payments" ADD COLUMN IF NOT EXISTS "isLocked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_payments" ADD COLUMN IF NOT EXISTS "unlockRequestedAt" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_payments" ADD COLUMN IF NOT EXISTS "unlockRequestedBy" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_payments" ADD COLUMN IF NOT EXISTS "unlockReason" text`,
    );
    await queryRunner.query(`
      ALTER TABLE "book_payments"
        ADD CONSTRAINT "FK_book_payments_unlockRequestedBy" FOREIGN KEY ("unlockRequestedBy")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // Backfill: existing approved book payments become locked so the unlock flow applies to them.
    await queryRunner.query(
      `UPDATE "book_payments" SET "isLocked" = true WHERE "approvalStatus" = 'APPROVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP CONSTRAINT IF EXISTS "FK_book_payments_unlockRequestedBy"`,
    );
    await queryRunner.query(`ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "unlockReason"`);
    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "unlockRequestedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "unlockRequestedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "book_payments" DROP COLUMN IF EXISTS "isLocked"`);
  }
}
