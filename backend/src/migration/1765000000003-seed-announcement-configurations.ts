import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAnnouncementConfigurations1765000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const announcementConfigs = [
      {
        module: 'announcement',
        key: 'announcement_target_types',
        label: 'Announcement Target Types',
        valueType: 'array',
        description: 'Types of targets for announcements (User, Role, All)',
        values: [
          { value: 'USER', label: 'Specific User' },
          { value: 'ROLE', label: 'Role' },
          { value: 'ALL', label: 'All Users' },
        ],
      },
      {
        module: 'announcement',
        key: 'announcement_statuses',
        label: 'Announcement Statuses',
        valueType: 'array',
        description: 'Available status options for announcements',
        values: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PUBLISHED', label: 'Published' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'ARCHIVED', label: 'Archived' },
        ],
      },
    ];

    for (const config of announcementConfigs) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const announcementKeys = ['announcement_target_types', 'announcement_statuses'];

    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'announcement'
       )`,
      [announcementKeys],
    );

    await queryRunner.query(
      `DELETE FROM configurations WHERE key = ANY($1) AND module = 'announcement'`,
      [announcementKeys],
    );
  }
}
