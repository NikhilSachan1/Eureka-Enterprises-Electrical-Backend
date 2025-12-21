import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedVehicleConfigurations1767000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const vehicleConfigs = [
      {
        module: 'vehicle',
        key: 'vehicle_fuel_types',
        label: 'Vehicle Fuel Types',
        valueType: 'array',
        description: 'Types of fuel/power for vehicles',
        values: [
          { value: 'PETROL', label: 'Petrol' },
          { value: 'DIESEL', label: 'Diesel' },
          { value: 'CNG', label: 'CNG' },
          { value: 'ELECTRIC', label: 'Electric' },
          { value: 'HYBRID', label: 'Hybrid' },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_statuses',
        label: 'Vehicle Statuses',
        valueType: 'array',
        description: 'Available status options for vehicles',
        values: [
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'ASSIGNED', label: 'Assigned' },
          { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
          { value: 'DAMAGED', label: 'Damaged' },
          { value: 'RETIRED', label: 'Retired' },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_file_types',
        label: 'Vehicle File Types',
        valueType: 'array',
        description: 'Types of documents/files that can be attached to vehicles',
        values: [
          { value: 'RC', label: 'Registration Certificate (RC)' },
          { value: 'INSURANCE', label: 'Insurance Document' },
          { value: 'PUC', label: 'PUC Certificate' },
          { value: 'FITNESS', label: 'Fitness Certificate' },
          { value: 'PERMIT', label: 'Permit' },
          { value: 'INVOICE', label: 'Purchase Invoice' },
          { value: 'SERVICE_BILL', label: 'Service Bill' },
          { value: 'VEHICLE_IMAGE', label: 'Vehicle Image' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_event_types',
        label: 'Vehicle Event Types',
        valueType: 'array',
        description: 'Types of events that can occur for a vehicle',
        values: [
          { value: 'VEHICLE_ADDED', label: 'Vehicle Added' },
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'ASSIGNED', label: 'Assigned' },
          { value: 'DEALLOCATED', label: 'Deallocated' },
          { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
          { value: 'DAMAGED', label: 'Damaged' },
          { value: 'RETIRED', label: 'Retired' },
          { value: 'UPDATED', label: 'Updated' },
          { value: 'HANDOVER_INITIATED', label: 'Handover Initiated' },
          { value: 'HANDOVER_ACCEPTED', label: 'Handover Accepted' },
          { value: 'HANDOVER_REJECTED', label: 'Handover Rejected' },
          { value: 'HANDOVER_CANCELLED', label: 'Handover Cancelled' },
        ],
      },
    ];

    // Insert array configs
    for (const config of vehicleConfigs) {
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

    // Insert expiring_soon_days configuration (number type)
    const expiringSoonConfig = {
      module: 'vehicle',
      key: 'vehicle_expiring_soon_days',
      label: 'Vehicle Document Expiring Soon Days',
      valueType: 'number',
      description: 'Number of days before a vehicle document is considered expiring soon',
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

    const [expiringSoonConfigRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [expiringSoonConfig.key, expiringSoonConfig.module],
    );

    if (expiringSoonConfigRow) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [expiringSoonConfigRow.id, '30'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const vehicleKeys = [
      'vehicle_fuel_types',
      'vehicle_statuses',
      'vehicle_file_types',
      'vehicle_event_types',
      'vehicle_expiring_soon_days',
    ];

    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'vehicle'
       )`,
      [vehicleKeys],
    );

    await queryRunner.query(
      `DELETE FROM configurations WHERE key = ANY($1) AND module = 'vehicle'`,
      [vehicleKeys],
    );
  }
}
