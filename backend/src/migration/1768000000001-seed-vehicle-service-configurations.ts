import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedVehicleServiceConfigurations1768000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const vehicleServiceConfigs = [
      {
        module: 'vehicle',
        key: 'vehicle_service_types',
        label: 'Vehicle Service Types',
        valueType: 'array',
        description: 'Types of vehicle services',
        values: [
          { value: 'REGULAR_SERVICE', label: 'Regular Service', resetsInterval: true },
          { value: 'EMERGENCY_SERVICE', label: 'Emergency Service', resetsInterval: true },
          { value: 'BREAKDOWN_REPAIR', label: 'Breakdown Repair', resetsInterval: false },
          { value: 'ACCIDENT_REPAIR', label: 'Accident Repair', resetsInterval: false },
          { value: 'TYRE_CHANGE', label: 'Tyre Change', resetsInterval: false },
          { value: 'BATTERY_REPLACEMENT', label: 'Battery Replacement', resetsInterval: false },
          { value: 'OTHER', label: 'Other', resetsInterval: false },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_service_statuses',
        label: 'Vehicle Service Statuses',
        valueType: 'array',
        description: 'Status options for vehicle services',
        values: [
          { value: 'PENDING', label: 'Pending' },
          { value: 'IN_PROGRESS', label: 'In Progress' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
          { value: 'SKIPPED', label: 'Skipped' },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_service_file_types',
        label: 'Vehicle Service File Types',
        valueType: 'array',
        description: 'Types of documents for vehicle services',
        values: [
          { value: 'INVOICE', label: 'Service Invoice' },
          { value: 'BILL', label: 'Bill' },
          { value: 'REPAIR_REPORT', label: 'Repair Report' },
          { value: 'WARRANTY_CARD', label: 'Warranty Card' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
    ];

    // Insert array configs
    for (const config of vehicleServiceConfigs) {
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (module, key) DO NOTHING`,
        [config.module, config.key, config.label, config.valueType, config.description],
      );

      const [configRow] = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
        [config.key, config.module],
      );

      if (configRow) {
        await queryRunner.query(
          `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [configRow.id, JSON.stringify(config.values)],
        );
      }
    }

    // Service interval configuration (in km)
    const intervalConfig = {
      module: 'vehicle',
      key: 'vehicle_service_interval_km',
      label: 'Vehicle Service Interval (KM)',
      valueType: 'number',
      description: 'Kilometers after which vehicle service is due',
    };

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        intervalConfig.module,
        intervalConfig.key,
        intervalConfig.label,
        intervalConfig.valueType,
        intervalConfig.description,
      ],
    );

    const [intervalConfigRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [intervalConfig.key, intervalConfig.module],
    );

    if (intervalConfigRow) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [intervalConfigRow.id, '10000'],
      );
    }

    // Service warning threshold (km before service is due)
    const warningConfig = {
      module: 'vehicle',
      key: 'vehicle_service_warning_km',
      label: 'Vehicle Service Warning Threshold (KM)',
      valueType: 'number',
      description: 'Kilometers before service due to show warning',
    };

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        warningConfig.module,
        warningConfig.key,
        warningConfig.label,
        warningConfig.valueType,
        warningConfig.description,
      ],
    );

    const [warningConfigRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [warningConfig.key, warningConfig.module],
    );

    if (warningConfigRow) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [warningConfigRow.id, '1000'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const vehicleServiceKeys = [
      'vehicle_service_types',
      'vehicle_service_statuses',
      'vehicle_service_file_types',
      'vehicle_service_interval_km',
      'vehicle_service_warning_km',
    ];

    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'vehicle'
       )`,
      [vehicleServiceKeys],
    );

    await queryRunner.query(
      `DELETE FROM configurations WHERE key = ANY($1) AND module = 'vehicle'`,
      [vehicleServiceKeys],
    );
  }
}
