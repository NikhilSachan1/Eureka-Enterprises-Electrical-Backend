import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVehicleStatusConfigs1792000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const configs = [
      {
        module: 'vehicle',
        key: 'vehicle_document_statuses',
        label: 'Vehicle Document Statuses',
        valueType: 'array',
        description:
          'Document expiry statuses for PUC, Fitness, and Insurance (computed based on end date)',
        isEditable: false,
        values: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
        ],
      },
      {
        module: 'vehicle',
        key: 'vehicle_service_due_statuses',
        label: 'Vehicle Service Due Statuses',
        valueType: 'array',
        description:
          'Service due statuses based on odometer reading and last service km (computed)',
        isEditable: false,
        values: [
          { value: 'OK', label: 'OK' },
          { value: 'DUE_SOON', label: 'Due Soon' },
          { value: 'OVERDUE', label: 'Overdue' },
        ],
      },
    ];

    for (const config of configs) {
      // Insert configuration
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (module, key) DO NOTHING`,
        [
          config.module,
          config.key,
          config.label,
          config.valueType,
          config.description,
          config.isEditable,
        ],
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const configKeys = ['vehicle_document_statuses', 'vehicle_service_due_statuses'];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'vehicle'
       )`,
      [configKeys],
    );

    // Delete configurations
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = ANY($1) AND module = 'vehicle'`,
      [configKeys],
    );
  }
}
