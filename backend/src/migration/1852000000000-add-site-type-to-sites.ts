import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds siteType (free-text) column to sites.
 * Captures the kind of work at the site (e.g. Civil, Electrical, Mechanical).
 */
export class AddSiteTypeToSites1852000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sites
        ADD COLUMN IF NOT EXISTS "siteType" VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sites
        DROP COLUMN IF EXISTS "siteType"
    `);
  }
}
