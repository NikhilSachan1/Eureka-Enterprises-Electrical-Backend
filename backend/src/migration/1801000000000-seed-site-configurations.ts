import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSiteConfigurations1801000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const configs = [
      {
        module: 'site',
        key: 'site_work_types',
        label: 'Site Work Types',
        valueType: 'array',
        description: 'Available work types for site projects (config-driven checklist)',
        isEditable: true,
        values: [
          { value: 'Testing', label: 'Testing' },
          { value: 'Erection', label: 'Erection' },
          { value: 'Inspection', label: 'Inspection' },
          { value: 'Commissioning', label: 'Commissioning' },
          { value: 'Maintenance', label: 'Maintenance' },
          { value: 'Installation', label: 'Installation' },
          { value: 'Survey', label: 'Survey' },
          { value: 'Calibration', label: 'Calibration' },
        ],
      },
      {
        module: 'site',
        key: 'site_statuses',
        label: 'Site Statuses',
        valueType: 'array',
        description: 'Available statuses for site lifecycle management',
        isEditable: false,
        values: [
          {
            value: 'upcoming',
            label: 'Upcoming',
            description: 'Site scheduled to start in future',
          },
          { value: 'ongoing', label: 'Ongoing', description: 'Site is currently active' },
          { value: 'hold', label: 'On Hold', description: 'Site work temporarily paused' },
          { value: 'completed', label: 'Completed', description: 'Site work finished' },
        ],
      },
    ];

    for (const config of configs) {
      // Insert configuration
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (key) DO NOTHING`,
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
    const configKeys = ['site_work_types', 'site_statuses'];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'site'
       )`,
      [configKeys],
    );

    // Delete configurations
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'site'`, [
      configKeys,
    ]);
  }
}
