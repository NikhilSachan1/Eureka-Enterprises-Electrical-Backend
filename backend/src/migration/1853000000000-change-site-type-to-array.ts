import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the single siteType VARCHAR column with siteTypes JSONB array.
 * A site can have multiple types (e.g. Civil, Electrical, Mechanical).
 */
export class ChangeSiteTypeToArray1853000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sites
        DROP COLUMN IF EXISTS "siteType",
        ADD COLUMN IF NOT EXISTS "siteTypes" JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sites
        DROP COLUMN IF EXISTS "siteTypes",
        ADD COLUMN IF NOT EXISTS "siteType" VARCHAR(100)
    `);
  }
}
