import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add estimatedBudget field to sites table
 *
 * Purpose: Enable budget tracking for site health score calculations
 * This field is optional (nullable) so existing sites won't be affected.
 *
 * The estimatedBudget is used in analytics to calculate:
 * - Budget adherence score (actual expenses vs estimated budget)
 * - Site health score component
 */
export class AddEstimatedBudgetToSites1811000000000 implements MigrationInterface {
  name = 'AddEstimatedBudgetToSites1811000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists to make migration idempotent
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sites' 
        AND column_name = 'estimatedBudget'
    `);

    if (columnExists.length === 0) {
      // Add estimatedBudget column to sites table
      await queryRunner.query(`
        ALTER TABLE sites 
        ADD COLUMN "estimatedBudget" DECIMAL(15, 2) NULL
      `);

      // Add comment for documentation
      await queryRunner.query(`
        COMMENT ON COLUMN sites."estimatedBudget" IS 
        'Estimated budget for the site in currency units. Used for budget adherence calculations in analytics and site health score.'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists before dropping
    const columnExists = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sites' 
        AND column_name = 'estimatedBudget'
    `);

    if (columnExists.length > 0) {
      await queryRunner.query(`
        ALTER TABLE sites 
        DROP COLUMN "estimatedBudget"
      `);
    }
  }
}
