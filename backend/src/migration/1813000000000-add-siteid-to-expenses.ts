import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSiteIdToExpenses1813000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add siteId column to expenses table
    await queryRunner.query(`
      ALTER TABLE "expenses" 
      ADD COLUMN IF NOT EXISTS "siteId" uuid NULL
    `);

    // Add index for siteId
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_expenses_siteId" ON "expenses" ("siteId")
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "expenses"
      ADD CONSTRAINT "FK_expenses_siteId" 
      FOREIGN KEY ("siteId") REFERENCES "sites"("id") 
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_siteId"
    `);

    // Remove index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_expenses_siteId"
    `);

    // Remove column
    await queryRunner.query(`
      ALTER TABLE "expenses" DROP COLUMN IF EXISTS "siteId"
    `);
  }
}
