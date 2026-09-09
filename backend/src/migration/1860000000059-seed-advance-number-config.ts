import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Config driving the auto-generated advance number (ADV-10001, ADV-10002 …).
 *
 * Same shape as `vendor_code_config`, and it carries `startFrom` from day one on purpose: the
 * generator derives the next number from MAX(seq)+1, which silently restarts at 1 on an empty
 * table. That is exactly the bug the vendor-code work had to go back and fix, so the floor is
 * built in rather than added later.
 *
 * `isEditable` is true so the prefix/padding can change without a deploy.
 *
 * Idempotent: NOT EXISTS guards on both inserts. Note this guards on *content* for the settings
 * row (via NOT EXISTS on configId) — see 1860000000056 for why an existence-only guard on a
 * pre-existing empty row silently seeds nothing.
 */
export class SeedAdvanceNumberConfig1860000000059 implements MigrationInterface {
  name = 'SeedAdvanceNumberConfig1860000000059';

  private static readonly CONFIG_KEY = 'advance_number_config';
  private static readonly VALUE = JSON.stringify({
    prefix: 'ADV-',
    padLength: 5,
    startFrom: 10001,
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    const key = SeedAdvanceNumberConfig1860000000059.CONFIG_KEY;

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'advance_payment', $1, 'Advance Number Format', 'json',
              'Prefix, zero-pad length and starting sequence for the auto-generated advance payment number',
              true, NOW(), NOW()
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
      [cfg.id, SeedAdvanceNumberConfig1860000000059.VALUE],
    );

    // Covers the case a settings row exists but is empty/null — the failure mode that left
    // asset_event_types blank in every environment.
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = $2::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL
          AND (cs.value IS NULL OR cs.value::text IN ('{}', '[]', 'null'))`,
      [key, SeedAdvanceNumberConfig1860000000059.VALUE],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const key = SeedAdvanceNumberConfig1860000000059.CONFIG_KEY;
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [key],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [key]);
  }
}
