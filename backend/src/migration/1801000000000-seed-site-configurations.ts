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
      {
        module: 'site',
        key: 'site_allocation_types',
        label: 'Site Allocation Types',
        valueType: 'array',
        description: 'Types of employee allocation to sites (full-time, part-time)',
        isEditable: true,
        values: [
          {
            value: 'full_time',
            label: 'Full Time',
            description: 'Employee works full-time at site',
          },
          {
            value: 'part_time',
            label: 'Part Time',
            description: 'Employee works part-time at site',
          },
          { value: 'temporary', label: 'Temporary', description: 'Short-term assignment' },
          { value: 'contract', label: 'Contract', description: 'Contract-based allocation' },
        ],
      },
      {
        module: 'site',
        key: 'site_roles',
        label: 'Site Roles',
        valueType: 'array',
        description: 'Roles that employees can have at a site',
        isEditable: true,
        values: [
          { value: 'Engineer', label: 'Engineer', description: 'Technical engineer role' },
          { value: 'Supervisor', label: 'Supervisor', description: 'Site supervisor role' },
          { value: 'Technician', label: 'Technician', description: 'Technical support role' },
          {
            value: 'Project Manager',
            label: 'Project Manager',
            description: 'Project management role',
          },
          {
            value: 'Site Incharge',
            label: 'Site Incharge',
            description: 'Overall site responsibility',
          },
          { value: 'Helper', label: 'Helper', description: 'General assistance role' },
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
    const configKeys = ['site_work_types', 'site_statuses', 'site_allocation_types', 'site_roles'];

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
