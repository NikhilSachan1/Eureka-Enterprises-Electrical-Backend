import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asset / vehicle handover 48-hour auto penalty.
 *
 * Three seeds, no schema change:
 *   1. the `asset_penalty` expense category the penalty is booked under,
 *   2. the `handover_auto_penalty` config — the feature's on/off switch, **seeded disabled**,
 *   3. `HANDOVER_AUTO_ACCEPTED` in the asset and vehicle event-type lists, so history screens can
 *      label the event the cron writes.
 *
 * Every statement is idempotent, and the category insert follows the `asset_loss_recovery` idiom
 * from migration 1822000000000.
 */
export class SeedHandoverAutoPenalty1860000000067 implements MigrationInterface {
  name = 'SeedHandoverAutoPenalty1860000000067';

  private static readonly CATEGORY = 'asset_penalty';
  private static readonly CONFIG_KEY = 'handover_auto_penalty';
  private static readonly EVENT_TYPE = 'HANDOVER_AUTO_ACCEPTED';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Expense category. `isSystemGenerated` keeps it out of the manual-entry pickers; the
    // allowedRoles list matches asset_loss_recovery so only office roles can use it by hand.
    await queryRunner.query(`
      UPDATE config_settings cs
      SET value = (
        CASE
          WHEN value::jsonb @> '[{"name": "asset_penalty"}]'::jsonb THEN value
          ELSE value::jsonb || '[{
            "name": "asset_penalty",
            "label": "Asset Penalty",
            "description": "Penalty charged when an asset or vehicle handover is left unattended past the configured window",
            "icon": "alert-triangle",
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

    // 2. The switch. `enabled: false` is deliberate — the feature ships dark and is turned on from
    // the configuration screen once the BA signs off. `hours` and `amount` are tunable there too.
    const existingConfig = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = 'asset'`,
      [SeedHandoverAutoPenalty1860000000067.CONFIG_KEY],
    );

    let configId: string;
    if (existingConfig.length === 0) {
      const [inserted] = await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ('asset', $1, 'Handover Auto Penalty', 'json', $2, true, NOW(), NOW())
         RETURNING id`,
        [
          SeedHandoverAutoPenalty1860000000067.CONFIG_KEY,
          'Penalty and auto-assignment when an asset or vehicle handover is left unattended. ' +
            'enabled=false disables the whole feature.',
        ],
      );
      configId = inserted.id;
    } else {
      configId = existingConfig[0].id;
    }

    const existingSetting = await queryRunner.query(
      `SELECT id FROM config_settings WHERE "configId" = $1`,
      [configId],
    );
    if (existingSetting.length === 0) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [
          configId,
          JSON.stringify({
            enabled: false,
            hours: 48,
            amount: 500,
            modules: { asset: true, vehicle: true },
          }),
        ],
      );
    }

    // 3. The new event type, in both lists.
    for (const key of ['asset_event_types', 'vehicle_event_types']) {
      await queryRunner.query(
        `UPDATE config_settings cs
            SET value = (
              CASE
                WHEN value::jsonb @> $1::jsonb THEN value
                ELSE value::jsonb || $2::jsonb
              END
            ),
            "updatedAt" = NOW()
           FROM configurations c
          WHERE cs."configId" = c.id
            AND c.key = $3
            AND cs."isActive" = true
            AND cs."deletedAt" IS NULL`,
        [
          JSON.stringify([{ value: SeedHandoverAutoPenalty1860000000067.EVENT_TYPE }]),
          JSON.stringify([
            {
              value: SeedHandoverAutoPenalty1860000000067.EVENT_TYPE,
              label: 'Handover Auto Accepted',
            },
          ]),
          key,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the event type from both lists.
    for (const key of ['asset_event_types', 'vehicle_event_types']) {
      await queryRunner.query(
        `UPDATE config_settings cs
            SET value = COALESCE((
                  SELECT jsonb_agg(elem)
                    FROM jsonb_array_elements(cs.value::jsonb) elem
                   WHERE elem->>'value' <> $1
                ), '[]'::jsonb),
            "updatedAt" = NOW()
           FROM configurations c
          WHERE cs."configId" = c.id
            AND c.key = $2
            AND cs."isActive" = true`,
        [SeedHandoverAutoPenalty1860000000067.EVENT_TYPE, key],
      );
    }

    // Remove the config and its setting.
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1 AND module = 'asset')`,
      [SeedHandoverAutoPenalty1860000000067.CONFIG_KEY],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1 AND module = 'asset'`, [
      SeedHandoverAutoPenalty1860000000067.CONFIG_KEY,
    ]);

    // Remove the expense category. Any penalty rows already written keep the string; they are
    // history and must not be rewritten.
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = COALESCE((
                SELECT jsonb_agg(elem)
                  FROM jsonb_array_elements(cs.value::jsonb) elem
                 WHERE elem->>'name' <> $1
              ), '[]'::jsonb),
          "updatedAt" = NOW()
         FROM configurations c
        WHERE cs."configId" = c.id
          AND c.key = 'expense_categories'
          AND cs."isActive" = true`,
      [SeedHandoverAutoPenalty1860000000067.CATEGORY],
    );
  }
}
