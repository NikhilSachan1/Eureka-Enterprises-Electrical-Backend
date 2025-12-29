import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAssetExpiringSoonDays1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert asset_expiring_soon_days configuration (number type)
    // This is used by CRON 13 (Calibration Expiry) and CRON 14 (Warranty Expiry)
    const expiringSoonConfig = {
      module: 'asset',
      key: 'asset_expiring_soon_days',
      label: 'Asset Expiring Soon Days',
      valueType: 'number',
      description:
        'Number of days before an asset calibration/warranty is considered expiring soon',
    };

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        expiringSoonConfig.module,
        expiringSoonConfig.key,
        expiringSoonConfig.label,
        expiringSoonConfig.valueType,
        expiringSoonConfig.description,
      ],
    );

    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [expiringSoonConfig.key, expiringSoonConfig.module],
    );

    if (configRow) {
      // Default to 30 days warning period
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [configRow.id, '30'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'asset_expiring_soon_days' AND module = 'asset'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'asset_expiring_soon_days' AND module = 'asset'`,
    );
  }
}
