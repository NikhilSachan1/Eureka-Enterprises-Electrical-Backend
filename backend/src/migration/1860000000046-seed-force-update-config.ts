import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the `system.force_update` configuration + its default config setting.
 *
 * Value drives the mobile app's force-update gate:
 *   { forceUpdate, minVersion, androidUpdateUrl, iosUpdateUrl }
 *
 * Idempotent: the configuration upserts on the (module, key) unique constraint,
 * and the config setting is only inserted when the config has none yet — so this
 * is safe to run on an environment where the config was already created via API.
 */
export class SeedForceUpdateConfig1860000000046 implements MigrationInterface {
  name = 'SeedForceUpdateConfig1860000000046';

  private readonly MODULE = 'system';
  private readonly KEY = 'force_update';
  private readonly VALUE = {
    forceUpdate: true,
    minVersion: '2.1.0',
    androidUpdateUrl: 'https://play.google.com/store/apps/details?id=com.eureka.eureka_people_ops',
    iosUpdateUrl: 'https://apps.apple.com/app/...',
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Configuration (catalog row) — idempotent on UQ_configurations_module_key
    await queryRunner.query(
      `INSERT INTO configurations
         (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        this.MODULE,
        this.KEY,
        'Force Update',
        'json',
        'Mobile app force-update settings (minimum supported version + store URLs).',
        true,
      ],
    );

    // 2) Resolve the configuration id
    const configRows = await queryRunner.query(
      `SELECT id FROM configurations WHERE module = $1 AND key = $2`,
      [this.MODULE, this.KEY],
    );
    if (!configRows.length) {
      return;
    }
    const configId = configRows[0].id;

    // 3) Default config setting — only when this config has no active setting yet
    await queryRunner.query(
      `INSERT INTO config_settings
         (id, "configId", "contextKey", value, "isActive", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), $1, 'default', $2::jsonb, true, NOW(), NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM config_settings WHERE "configId" = $1 AND "deletedAt" IS NULL
       )`,
      [configId, JSON.stringify(this.VALUE)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const configRows = await queryRunner.query(
      `SELECT id FROM configurations WHERE module = $1 AND key = $2`,
      [this.MODULE, this.KEY],
    );

    if (configRows.length) {
      await queryRunner.query(`DELETE FROM config_settings WHERE "configId" = $1`, [
        configRows[0].id,
      ]);
    }

    await queryRunner.query(`DELETE FROM configurations WHERE module = $1 AND key = $2`, [
      this.MODULE,
      this.KEY,
    ]);
  }
}
