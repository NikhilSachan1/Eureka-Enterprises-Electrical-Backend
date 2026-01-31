import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedVehicleLogConfig1810000000000 implements MigrationInterface {
  name = 'SeedVehicleLogConfig1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert anomaly threshold configuration
    const existingAnomalyConfig = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'vehicle_log_anomaly_threshold' AND module = 'vehicle'`,
    );

    let anomalyConfigId: string;
    if (existingAnomalyConfig.length === 0) {
      const [inserted] = await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        [
          'vehicle',
          'vehicle_log_anomaly_threshold',
          'Vehicle Log Anomaly Threshold',
          'number',
          'Anomaly threshold multiplier for vehicle logs. If actual KM > expected KM × threshold, log is flagged. Default 1.5 means 150% of expected.',
          true,
        ],
      );
      anomalyConfigId = inserted.id;
    } else {
      anomalyConfigId = existingAnomalyConfig[0].id;
    }

    // Check if setting already exists
    const existingAnomalySetting = await queryRunner.query(
      `SELECT id FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
      [anomalyConfigId],
    );

    if (existingAnomalySetting.length === 0) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [anomalyConfigId, JSON.stringify(1.5), true],
      );
    }

    // 2. Insert backfill days allowed configuration
    const existingBackfillConfig = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'vehicle_log_backfill_days_allowed' AND module = 'vehicle'`,
    );

    let backfillConfigId: string;
    if (existingBackfillConfig.length === 0) {
      const [inserted] = await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id`,
        [
          'vehicle',
          'vehicle_log_backfill_days_allowed',
          'Vehicle Log Backfill Days Allowed',
          'number',
          'Number of days back employees can create/edit vehicle logs. HR/Admin can always backfill beyond this. Default is 2 days.',
          true,
        ],
      );
      backfillConfigId = inserted.id;
    } else {
      backfillConfigId = existingBackfillConfig[0].id;
    }

    // Check if setting already exists
    const existingBackfillSetting = await queryRunner.query(
      `SELECT id FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
      [backfillConfigId],
    );

    if (existingBackfillSetting.length === 0) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [backfillConfigId, JSON.stringify(2), true],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config settings first
    await queryRunner.query(`
      DELETE FROM config_settings 
      WHERE "configId" IN (
        SELECT id FROM configurations 
        WHERE key IN ('vehicle_log_anomaly_threshold', 'vehicle_log_backfill_days_allowed') 
        AND module = 'vehicle'
      )
    `);

    // Delete configurations
    await queryRunner.query(`
      DELETE FROM configurations 
      WHERE key IN ('vehicle_log_anomaly_threshold', 'vehicle_log_backfill_days_allowed') 
      AND module = 'vehicle'
    `);
  }
}
