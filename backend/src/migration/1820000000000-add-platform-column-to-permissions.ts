import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformColumnToPermissions1820000000000 implements MigrationInterface {
  name = 'AddPlatformColumnToPermissions1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add platform column with default 'web' for existing permissions
    await queryRunner.query(`
      ALTER TABLE "permissions" 
      ADD COLUMN "platform" VARCHAR(10) NOT NULL DEFAULT 'web'
    `);

    // Create index on platform column
    await queryRunner.query(`
      CREATE INDEX "IDX_PERMISSIONS_PLATFORM" ON "permissions" ("platform")
    `);

    // Drop the existing unique constraint on name
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_permissions_name"
    `);

    // Drop existing unique constraint if it exists
    await queryRunner.query(`
      ALTER TABLE "permissions" DROP CONSTRAINT IF EXISTS "UQ_permissions_name"
    `);

    // Create new unique constraint on (name, platform) combination
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_permissions_name_platform" 
      ON "permissions" ("name", "platform") 
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the combined unique constraint
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_permissions_name_platform"
    `);

    // Recreate the original unique constraint on name only
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_permissions_name" ON "permissions" ("name")
    `);

    // Drop platform index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_PERMISSIONS_PLATFORM"
    `);

    // Remove platform column
    await queryRunner.query(`
      ALTER TABLE "permissions" DROP COLUMN "platform"
    `);
  }
}
