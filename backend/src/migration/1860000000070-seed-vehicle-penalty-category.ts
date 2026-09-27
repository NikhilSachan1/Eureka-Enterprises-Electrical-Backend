import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A second expense category for the handover auto-penalty: `vehicle_penalty`.
 *
 * Migration `…067` seeded only `asset_penalty`, and the cron filed **both** asset and vehicle
 * penalties under it. The two were distinguishable only by the internal reference type, which the
 * expense list does not filter on — so a vehicle penalty read as "Asset Penalty" and could neither
 * be filtered for nor filtered out. One category per module fixes both.
 *
 * Any penalty rows already written keep the category they were written with; the feature ships
 * disabled and has not run anywhere, so there are none to correct.
 */
export class SeedVehiclePenaltyCategory1860000000070 implements MigrationInterface {
  name = 'SeedVehiclePenaltyCategory1860000000070';

  private static readonly CATEGORY = 'vehicle_penalty';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE config_settings cs
      SET value = (
        CASE
          WHEN value::jsonb @> '[{"name": "vehicle_penalty"}]'::jsonb THEN value
          ELSE value::jsonb || '[{
            "name": "vehicle_penalty",
            "label": "Vehicle Penalty",
            "description": "Penalty charged when a vehicle handover is left unattended past the configured window",
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

    // `asset_penalty` now means assets only, so its wording is narrowed to match.
    await queryRunner.query(`
      UPDATE config_settings cs
      SET value = (
        SELECT jsonb_agg(
          CASE
            WHEN elem->>'name' = 'asset_penalty'
              THEN jsonb_set(
                elem,
                '{description}',
                '"Penalty charged when an asset handover is left unattended past the configured window"'::jsonb
              )
            ELSE elem
          END
        )
        FROM jsonb_array_elements(cs.value::jsonb) elem
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
      [SeedVehiclePenaltyCategory1860000000070.CATEGORY],
    );
  }
}
