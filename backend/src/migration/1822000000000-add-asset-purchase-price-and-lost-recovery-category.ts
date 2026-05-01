import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetPurchasePriceAndLostRecoveryCategory1822000000000
  implements MigrationInterface
{
  name = 'AddAssetPurchasePriceAndLostRecoveryCategory1822000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add purchasePrice column to asset_versions (default '0' for backfill)
    await queryRunner.query(`
      ALTER TABLE "asset_versions"
      ADD COLUMN IF NOT EXISTS "purchasePrice" varchar DEFAULT '0'
    `);

    // 2. Append asset_loss_recovery to expense_categories config (only for ADMIN/SUPER_ADMIN/HR)
    // Skip if it already exists (idempotent)
    await queryRunner.query(`
      UPDATE config_settings cs
      SET value = (
        CASE
          WHEN value::jsonb @> '[{"name": "asset_loss_recovery"}]'::jsonb THEN value
          ELSE value::jsonb || '[{
            "name": "asset_loss_recovery",
            "label": "Asset Loss Recovery",
            "description": "Recovery amount charged when an asset assigned to an employee is marked as lost",
            "icon": "shield-exclamation",
            "isSystemGenerated": true,
            "allowedRoles": ["SUPER_ADMIN", "ADMIN", "HR"]
          }]'::jsonb
        END
      ),
      "updatedAt" = NOW()
      FROM configurations c
      WHERE cs."configId" = c.id
        AND c.key = 'expense_categories'
        AND cs."isActive" = true
        AND cs."deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Remove asset_loss_recovery from expense_categories config
    await queryRunner.query(`
      UPDATE config_settings cs
      SET value = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(value::jsonb) elem
        WHERE elem->>'name' != 'asset_loss_recovery'
      ),
      "updatedAt" = NOW()
      FROM configurations c
      WHERE cs."configId" = c.id
        AND c.key = 'expense_categories'
        AND cs."isActive" = true
        AND cs."deletedAt" IS NULL
    `);

    // 2. Drop purchasePrice column
    await queryRunner.query(`
      ALTER TABLE "asset_versions" DROP COLUMN IF EXISTS "purchasePrice"
    `);
  }
}
