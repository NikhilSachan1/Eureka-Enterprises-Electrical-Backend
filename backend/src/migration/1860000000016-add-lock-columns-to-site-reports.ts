import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Site Reports become auto-approved + auto-locked on creation, with a JMC-style
 * unlock workflow. Adds the lock/unlock tracking columns and backfills existing
 * APPROVED rows to isLocked=true so they can use the new unlock flow. Existing
 * PENDING rows are left untouched.
 */
export class AddLockColumnsToSiteReports1860000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "site_reports" ADD COLUMN IF NOT EXISTS "isLocked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_reports" ADD COLUMN IF NOT EXISTS "unlockRequestedAt" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_reports" ADD COLUMN IF NOT EXISTS "unlockRequestedBy" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "site_reports" ADD COLUMN IF NOT EXISTS "unlockReason" text`,
    );
    await queryRunner.query(`
      ALTER TABLE "site_reports"
        ADD CONSTRAINT "FK_site_reports_unlockRequestedBy" FOREIGN KEY ("unlockRequestedBy")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // Backfill: existing approved reports become locked so the unlock flow applies to them.
    await queryRunner.query(
      `UPDATE "site_reports" SET "isLocked" = true WHERE "approvalStatus" = 'APPROVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "site_reports" DROP CONSTRAINT IF EXISTS "FK_site_reports_unlockRequestedBy"`,
    );
    await queryRunner.query(`ALTER TABLE "site_reports" DROP COLUMN IF EXISTS "unlockReason"`);
    await queryRunner.query(`ALTER TABLE "site_reports" DROP COLUMN IF EXISTS "unlockRequestedBy"`);
    await queryRunner.query(`ALTER TABLE "site_reports" DROP COLUMN IF EXISTS "unlockRequestedAt"`);
    await queryRunner.query(`ALTER TABLE "site_reports" DROP COLUMN IF EXISTS "isLocked"`);
  }
}
