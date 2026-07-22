import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed configurations + config_settings for the two legal document URLs:
 *   - Terms and Conditions document URL
 *   - Privacy Policy document URL
 *
 * Each is a `system` module configuration of valueType `text` holding the public doc URL
 * (matching how other single-value configs are stored, e.g. payments.sheet_number_format).
 * The config_setting is seeded with an EMPTY value ("") as a placeholder — set the actual
 * URL afterwards via the config-settings admin UI / API.
 *
 * Idempotent: uses NOT EXISTS guards so re-running never duplicates rows.
 */
export class SeedTermsPrivacyPolicyConfig1860000000028 implements MigrationInterface {
  private readonly module = 'system';

  // [key, label, description]. Keys follow the dominant DB convention: bare snake_case,
  // no module prefix (e.g. asset_expiring_soon_days, vehicle_expiring_soon_days).
  private readonly configs: Array<[string, string, string]> = [
    [
      'terms_and_conditions_url',
      'Terms and Conditions URL',
      'Public URL of the Terms and Conditions document',
    ],
    ['privacy_policy_url', 'Privacy Policy URL', 'Public URL of the Privacy Policy document'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [key, label, description] of this.configs) {
      // 1. Configuration row (guarded on unique key).
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         SELECT $1, $2, $3, 'text', $4, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $2)`,
        [this.module, key, label, description],
      );

      // 2. Fetch its id.
      const [configRow] = await queryRunner.query(`SELECT id FROM configurations WHERE key = $1`, [
        key,
      ]);
      if (!configRow) continue;

      // 3. Config setting holding the URL. Seeded empty ("") — fill the real URL later.
      //    value is jsonb; '""' is a valid JSON empty string.
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         SELECT $1, $2::jsonb, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM config_settings WHERE "configId" = $1)`,
        [configRow.id, '""'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keys = this.configs.map(([key]) => key);
    // Delete config_settings first (FK), then the configurations.
    await queryRunner.query(
      `DELETE FROM config_settings
       WHERE "configId" IN (SELECT id FROM configurations WHERE key = ANY($1))`,
      [keys],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1)`, [keys]);
  }
}
