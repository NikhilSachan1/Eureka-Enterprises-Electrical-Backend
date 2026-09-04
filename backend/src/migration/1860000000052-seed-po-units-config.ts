import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `po_units` dropdown that drives the unit on PO line items.
 *
 * Same shape as every other dropdown config in the system (`bank_names_dropdown`,
 * `asset_categories`): a `configurations` row plus a `config_settings.value` holding a jsonb array
 * of {label, value}. `isEditable` is true so units can be added or removed from the config-settings
 * admin UI without a deploy.
 *
 * Read by FE through the existing generic config API — no PO-specific endpoint:
 *   GET /configurations/details?key=po_units
 *
 * The backend also validates a submitted unit against this list, so removing a unit here stops it
 * being accepted on new POs (rows already saved with it are untouched).
 *
 * Idempotent: NOT EXISTS guards on both inserts.
 */
export class SeedPoUnitsConfig1860000000052 implements MigrationInterface {
  name = 'SeedPoUnitsConfig1860000000052';

  private static readonly CONFIG_KEY = 'po_units';

  // Label and value are intentionally identical — the unit is displayed exactly as stored, and a
  // PO PDF must print the same text the user picked.
  private static readonly UNITS = [
    'Nos',
    'Each',
    'Set',
    'Pair',
    'Job',
    'LS',
    'Rmt',
    'm',
    'mm',
    'cm',
    'km',
    'Rft',
    'Ft',
    'Inch',
    'Sqm',
    'Sqft',
    'Sqyd',
    'Cum',
    'Cft',
    'Brass',
    'Ltr',
    'Kg',
    'gm',
    'MT',
    'Qtl',
    'Bag',
    'Bundle',
    'Roll',
    'Coil',
    'Box',
    'Packet',
    'Drum',
    'Tin',
    'Sheet',
    'Point',
    'Hour',
    'Day',
    'Trip',
    'Load',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoUnitsConfig1860000000052.CONFIG_KEY;

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'purchase_order', $1, 'PO Units', 'array',
              'Units of measure selectable on PO line items', true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)`,
      [key],
    );

    const [cfg] = await queryRunner.query(`SELECT id FROM configurations WHERE key = $1`, [key]);
    if (!cfg) {
      return;
    }

    const value = JSON.stringify(
      SeedPoUnitsConfig1860000000052.UNITS.map((u) => ({ label: u, value: u })),
    );

    await queryRunner.query(
      `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
       SELECT $1, $2::jsonb, true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM config_settings WHERE "configId" = $1)`,
      [cfg.id, value],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const key = SeedPoUnitsConfig1860000000052.CONFIG_KEY;
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [key],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [key]);
  }
}
