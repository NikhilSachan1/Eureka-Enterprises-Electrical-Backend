import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardStatusesConfig1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Define card statuses configuration
    const config = {
      module: 'card',
      key: 'card_statuses',
      label: 'Card Statuses',
      valueType: 'array',
      description: 'Card expiry statuses (Valid, Expiring Soon, Expired)',
      values: [
        { value: 'VALID', label: 'Valid' },
        { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
        { value: 'EXPIRED', label: 'Expired' },
      ],
    };

    // Insert configuration
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [config.module, config.key, config.label, config.valueType, config.description],
    );

    // Get the configuration id
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [config.key, config.module],
    );

    if (configRow) {
      // Insert config settings with the values
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [configRow.id, JSON.stringify(config.values)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'card_statuses' AND module = 'card'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'card_statuses' AND module = 'card'`,
    );
  }
}
