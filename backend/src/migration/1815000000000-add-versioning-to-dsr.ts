import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVersioningToDsr1815000000000 implements MigrationInterface {
  name = 'AddVersioningToDsr1815000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add versioning columns to daily_status_reports table
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD COLUMN IF NOT EXISTS "originalDsrId" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD COLUMN IF NOT EXISTS "parentDsrId" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD COLUMN IF NOT EXISTS "versionNumber" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD COLUMN IF NOT EXISTS "editReason" text NULL
    `);

    // Add indexes for versioning columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_DSR_IS_ACTIVE" ON "daily_status_reports" ("isActive")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_DSR_ORIGINAL_ID" ON "daily_status_reports" ("originalDsrId")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD CONSTRAINT "FK_dsr_original_dsr" 
      FOREIGN KEY ("originalDsrId") REFERENCES "daily_status_reports"("id") 
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD CONSTRAINT "FK_dsr_parent_dsr" 
      FOREIGN KEY ("parentDsrId") REFERENCES "daily_status_reports"("id") 
      ON DELETE SET NULL
    `);

    // Drop old unique constraint and create new one that includes isActive
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      DROP CONSTRAINT IF EXISTS "UQ_DSR_SITE_USER_DATE"
    `);

    // Create new unique constraint - only one active DSR per site/user/date
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_DSR_SITE_USER_DATE_ACTIVE" 
      ON "daily_status_reports" ("siteId", "userId", "reportDate") 
      WHERE "isActive" = true AND "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new unique constraint
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_DSR_SITE_USER_DATE_ACTIVE"
    `);

    // Restore old unique constraint
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      ADD CONSTRAINT "UQ_DSR_SITE_USER_DATE" UNIQUE ("siteId", "userId", "reportDate")
    `);

    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      DROP CONSTRAINT IF EXISTS "FK_dsr_parent_dsr"
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" 
      DROP CONSTRAINT IF EXISTS "FK_dsr_original_dsr"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_DSR_ORIGINAL_ID"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_DSR_IS_ACTIVE"
    `);

    // Drop versioning columns
    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" DROP COLUMN IF EXISTS "editReason"
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" DROP COLUMN IF EXISTS "versionNumber"
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" DROP COLUMN IF EXISTS "parentDsrId"
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" DROP COLUMN IF EXISTS "originalDsrId"
    `);

    await queryRunner.query(`
      ALTER TABLE "daily_status_reports" DROP COLUMN IF EXISTS "isActive"
    `);
  }
}
