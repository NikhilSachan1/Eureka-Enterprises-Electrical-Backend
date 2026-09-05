import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repairs the `asset_event_types` config, which is empty (`[]`) in every environment despite
 * `1781000000000-seed-asset-event-types-configuration` being recorded as executed.
 *
 * Why the original seed did nothing: it guarded on the *existence* of a config_settings row —
 *
 *   SELECT id FROM config_settings WHERE "configId" = $1
 *   if (existingSetting.length === 0) { insert the values }
 *
 * — and an empty row already existed for that config, so it took the else branch, inserted nothing,
 * and still recorded itself as run. TypeORM never retries a recorded migration, so the config has
 * sat empty ever since (dev and prod both show value `[]`, created 2025-12-30, never updated).
 * The sibling `vehicle_event_types` seed was unaffected and holds its 12 values correctly.
 *
 * This migration guards on **content** rather than existence, which is the fix for that class of
 * bug: it only writes when the value is missing or empty, so an admin who has since curated the
 * list through the config UI is never clobbered.
 *
 * The list is 15 entries, not the original 13: `LOST` and `RECOVERED` were added to the
 * `AssetEventTypes` enum with the mark-lost / mark-recovered feature, so the 2025 seed was already
 * out of date. Kept in enum order.
 */
export class BackfillAssetEventTypesConfig1860000000056 implements MigrationInterface {
  name = 'BackfillAssetEventTypesConfig1860000000056';

  private static readonly CONFIG_KEY = 'asset_event_types';

  // Mirrors AssetEventTypes in asset-masters.constants.ts.
  private static readonly EVENT_TYPES = [
    { value: 'ASSET_ADDED', label: 'Asset Added' },
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'DEALLOCATED', label: 'Deallocated' },
    { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
    { value: 'CALIBRATED', label: 'Calibrated' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'RETIRED', label: 'Retired' },
    { value: 'UPDATED', label: 'Updated' },
    { value: 'HANDOVER_INITIATED', label: 'Handover Initiated' },
    { value: 'HANDOVER_ACCEPTED', label: 'Handover Accepted' },
    { value: 'HANDOVER_REJECTED', label: 'Handover Rejected' },
    { value: 'HANDOVER_CANCELLED', label: 'Handover Cancelled' },
    { value: 'LOST', label: 'Lost' },
    { value: 'RECOVERED', label: 'Recovered' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const key = BackfillAssetEventTypesConfig1860000000056.CONFIG_KEY;
    const value = JSON.stringify(BackfillAssetEventTypesConfig1860000000056.EVENT_TYPES);

    // The configuration row itself should already exist; create it only if the 2025 migration
    // never got that far in some environment.
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'asset', $1, 'Asset Event Types', 'array',
              'Types of events that can occur for an asset', true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1 AND module = 'asset')`,
      [key],
    );

    // Case 1 — a settings row exists but is empty/null: fill it in.
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = $2::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL
          AND (cs.value IS NULL OR jsonb_typeof(cs.value) <> 'array' OR jsonb_array_length(cs.value) = 0)`,
      [key, value],
    );

    // Case 2 — no settings row at all: create one.
    await queryRunner.query(
      `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
       SELECT c.id, $2::jsonb, true, NOW(), NOW()
         FROM configurations c
        WHERE c.key = $1
          AND NOT EXISTS (
            SELECT 1 FROM config_settings cs
             WHERE cs."configId" = c.id AND cs."deletedAt" IS NULL)`,
      [key, value],
    );
  }

  /**
   * Restores the empty array — the exact state before this ran. Note this discards any values,
   * including ones an admin added later; that is the faithful inverse, not an oversight.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = '[]'::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL`,
      [BackfillAssetEventTypesConfig1860000000056.CONFIG_KEY],
    );
  }
}
