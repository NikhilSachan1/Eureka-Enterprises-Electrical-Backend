import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedVehicleLogConfig1810000000000 implements MigrationInterface {
  name = 'SeedVehicleLogConfig1810000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert anomaly threshold configuration
    const anomalyConfigResult = await queryRunner.query(`
      INSERT INTO configurations (id, key, module, description, "isActive", "createdAt", "updatedAt")
      VALUES (
        uuid_generate_v4(),
        'vehicle_log_anomaly_threshold',
        'vehicle',
        'Anomaly threshold multiplier for vehicle logs. If actual KM > expected KM × threshold, log is flagged. Default 1.5 means 150% of expected.',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (module, key) DO NOTHING
      RETURNING id
    `);

    if (anomalyConfigResult && anomalyConfigResult.length > 0) {
      await queryRunner.query(
        `
        INSERT INTO config_settings (id, "configId", label, value, "valueType", "isEditable", "isActive", "createdAt", "updatedAt")
        VALUES (
          uuid_generate_v4(),
          $1,
          'Anomaly Threshold',
          '1.5',
          'number',
          true,
          true,
          NOW(),
          NOW()
        )
      `,
        [anomalyConfigResult[0].id],
      );
    }

    // 2. Insert backfill days allowed configuration
    const backfillConfigResult = await queryRunner.query(`
      INSERT INTO configurations (id, key, module, description, "isActive", "createdAt", "updatedAt")
      VALUES (
        uuid_generate_v4(),
        'vehicle_log_backfill_days_allowed',
        'vehicle',
        'Number of days back employees can create/edit vehicle logs. HR/Admin can always backfill beyond this. Default is 2 days.',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (module, key) DO NOTHING
      RETURNING id
    `);

    if (backfillConfigResult && backfillConfigResult.length > 0) {
      await queryRunner.query(
        `
        INSERT INTO config_settings (id, "configId", label, value, "valueType", "isEditable", "isActive", "createdAt", "updatedAt")
        VALUES (
          uuid_generate_v4(),
          $1,
          'Backfill Days Allowed',
          '2',
          'number',
          true,
          true,
          NOW(),
          NOW()
        )
      `,
        [backfillConfigResult[0].id],
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
