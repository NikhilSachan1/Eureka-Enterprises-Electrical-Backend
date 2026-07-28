import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vendor-code setup:
 *   1. Seed the config that drives the runtime format — `configurations`/`config_settings`,
 *      module `vendor`, key `vendor_code_config`, valueType `json`, value {prefix, padLength}.
 *      Editable via the config-settings admin UI (change the prefix/padding without a deploy).
 *   2. Backfill existing vendors with codes (oldest first, by createdAt) so none are left blank.
 *
 * Backfill is idempotent: only rows with a NULL `vendorCode` are assigned, and the sequence
 * continues after the current max — safe to re-run.
 */
const CONFIG_VALUE = JSON.stringify({ prefix: 'VEN-', padLength: 4 });

export class SeedVendorCodeConfigAndBackfill1860000000045 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) config
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'vendor', 'vendor_code_config', 'Vendor Code Format', 'json',
              'Prefix and zero-pad length for the auto-generated vendor code', true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = 'vendor_code_config')`,
    );
    const [cfg] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'vendor_code_config'`,
    );
    if (cfg) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         SELECT $1, $2::jsonb, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM config_settings WHERE "configId" = $1)`,
        [cfg.id, CONFIG_VALUE],
      );
    }

    // 2) backfill existing vendors (oldest first), continuing after the current max sequence
    await queryRunner.query(
      `WITH base AS (
         SELECT COALESCE(MAX(CAST(substring("vendorCode" from '(\\d+)$') AS INTEGER)), 0) AS maxseq
         FROM vendors WHERE "vendorCode" LIKE 'VEN-%'
       ),
       ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
         FROM vendors WHERE "vendorCode" IS NULL AND "deletedAt" IS NULL
       )
       UPDATE vendors v
       SET "vendorCode" = 'VEN-' || LPAD((b.maxseq + o.rn)::text, 4, '0'), "updatedAt" = NOW()
       FROM ordered o CROSS JOIN base b
       WHERE v.id = o.id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM config_settings WHERE "configId" IN (SELECT id FROM configurations WHERE key = 'vendor_code_config')`,
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = 'vendor_code_config'`);
    // Note: backfilled vendorCode values are intentionally NOT cleared on down.
  }
}
