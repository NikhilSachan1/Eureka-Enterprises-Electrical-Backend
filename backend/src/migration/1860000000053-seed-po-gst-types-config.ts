import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `po_gst_types` dropdown so FE reads the GST-type options from config, the same way it
 * reads `po_units` and every other dropdown — one source instead of a hardcoded FE constant.
 *
 *   GET /configurations/details?key=po_gst_types
 *
 * DISPLAY ONLY — unlike `po_units`, this config does not drive behaviour:
 *   - `CreatePurchaseOrderDto.gstType` validates with `@IsIn(['CGST_SGST','IGST'])`, not against
 *     this config, so the DTO stays the source of truth for what is accepted.
 *   - `po-pdf.service.ts` branches on `gstType === 'IGST'` to choose between an IGST row and a
 *     CGST + SGST split, so an extra value added here would silently print as CGST + SGST.
 *
 * That is deliberate rather than an oversight: the two values are fixed by Indian GST law
 * (intra-state = CGST + SGST, inter-state = IGST), so a third option is not a configuration
 * choice — it would be a code change. `isEditable` is left **false** to signal exactly that.
 *
 * Idempotent: NOT EXISTS guards on both inserts.
 */
export class SeedPoGstTypesConfig1860000000053 implements MigrationInterface {
  name = 'SeedPoGstTypesConfig1860000000053';

  private static readonly CONFIG_KEY = 'po_gst_types';

  private static readonly GST_TYPES = [
    { label: 'CGST + SGST', value: 'CGST_SGST' },
    { label: 'IGST', value: 'IGST' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoGstTypesConfig1860000000053.CONFIG_KEY;

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'purchase_order', $1, 'PO GST Types', 'array',
              'GST split options for a PO (display list for FE). Accepted values are fixed in code — CGST_SGST or IGST.',
              false, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)`,
      [key],
    );

    const [cfg] = await queryRunner.query(`SELECT id FROM configurations WHERE key = $1`, [key]);
    if (!cfg) {
      return;
    }

    await queryRunner.query(
      `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
       SELECT $1, $2::jsonb, true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM config_settings WHERE "configId" = $1)`,
      [cfg.id, JSON.stringify(SeedPoGstTypesConfig1860000000053.GST_TYPES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoGstTypesConfig1860000000053.CONFIG_KEY;
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [key],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [key]);
  }
}
