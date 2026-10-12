import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `po_types` dropdown so the FE reads PO Type options from config, the same way it reads
 * `po_units` and `po_gst_types` — one source instead of a hardcoded FE constant.
 *
 *   GET /configurations/details?key=po_types
 *
 * DISPLAY ONLY, exactly like `po_gst_types`, and for a stronger reason: this value drives
 * behaviour, it does not merely label it.
 *   - `CreatePurchaseOrderDto.poType` validates against the `PoType` enum, not against this config.
 *   - `chk_po_type` in the database only accepts the same three values.
 *   - The No-JMC invoice route asks specifically for `SUPPLY_ITEM`; a fourth type added here would
 *     have no rule attached to it and would be refused by both of the above anyway.
 *
 * So a new PO type is a code change, not a configuration change. `isEditable` is left **false** to
 * say so on the configuration screen.
 *
 * Idempotent: NOT EXISTS guards on both inserts.
 */
export class SeedPoTypesConfig1860000000073 implements MigrationInterface {
  name = 'SeedPoTypesConfig1860000000073';

  private static readonly CONFIG_KEY = 'po_types';

  private static readonly PO_TYPES = [
    { label: 'Supply Item', value: 'SUPPLY_ITEM' },
    { label: 'Service Item', value: 'SERVICE_ITEM' },
    { label: 'Both', value: 'BOTH' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoTypesConfig1860000000073.CONFIG_KEY;

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'purchase_order', $1, 'PO Types', 'array',
              'What a PO buys (display list for FE). Accepted values are fixed in code and in the chk_po_type constraint: SUPPLY_ITEM, SERVICE_ITEM or BOTH. Only SUPPLY_ITEM allows an invoice without a JMC.',
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
      [cfg.id, JSON.stringify(SeedPoTypesConfig1860000000073.PO_TYPES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoTypesConfig1860000000073.CONFIG_KEY;
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [key],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [key]);
  }
}
