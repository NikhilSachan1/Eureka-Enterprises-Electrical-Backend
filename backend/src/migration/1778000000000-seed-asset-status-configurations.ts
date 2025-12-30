import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAssetStatusConfigurations1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const statusConfigs = [
      {
        module: 'asset',
        key: 'warranty_statuses',
        label: 'Warranty Statuses',
        valueType: 'array',
        description: 'Available warranty status options for assets',
        values: [
          { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
          { value: 'UNDER_WARRANTY', label: 'Under Warranty' },
          { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
          { value: 'EXPIRED', label: 'Expired' },
        ],
      },
      {
        module: 'asset',
        key: 'calibration_statuses',
        label: 'Calibration Statuses',
        valueType: 'array',
        description: 'Available calibration status options for assets',
        values: [
          { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
          { value: 'VALID', label: 'Valid' },
          { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
          { value: 'EXPIRED', label: 'Expired' },
        ],
      },
    ];

    for (const config of statusConfigs) {
      // Check if configuration already exists
      const existingConfig = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
        [config.key, config.module],
      );

      let configId: string;

      if (existingConfig.length === 0) {
        // Insert new configuration
        const [inserted] = await queryRunner.query(
          `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
           RETURNING id`,
          [config.module, config.key, config.label, config.valueType, config.description],
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
          [configId, JSON.stringify(config.values)],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const statusKeys = ['warranty_statuses', 'calibration_statuses'];

    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'asset'
       )`,
      [statusKeys],
    );

    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'asset'`, [
      statusKeys,
    ]);
  }
}
