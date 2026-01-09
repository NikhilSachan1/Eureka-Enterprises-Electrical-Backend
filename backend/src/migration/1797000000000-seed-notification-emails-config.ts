import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedNotificationEmailsConfig1797000000000 implements MigrationInterface {
  name = 'SeedNotificationEmailsConfig1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the configuration entry for notification_emails
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        'system',
        'notification_emails',
        'Notification Emails',
        'json',
        'Email addresses for system notifications (cron failures, alerts, etc.)',
        true,
      ],
    );

    // Get the configuration ID
    const configResult = await queryRunner.query(`
      SELECT id FROM configurations WHERE key = 'notification_emails' AND module = 'system'
    `);

    if (configResult.length > 0) {
      const configId = configResult[0].id;

      // Create the config setting with default notification emails
      // Update these emails as per your organization's requirements
      await queryRunner.query(`
        INSERT INTO config_settings (id, "configId", "contextKey", value, "isActive", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          '${configId}',
          'default',
          '${JSON.stringify({
            adminEmails: ['admin@company.com'],
            hrEmails: ['hr@company.com'],
            financeEmails: ['finance@company.com'],
            assetManagerEmails: ['asset.manager@company.com'],
            cronFailureEmails: ['cron.failure@company.com'],
          }).replace(/'/g, "''")}',
          true,
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get the configuration ID
    const configResult = await queryRunner.query(`
      SELECT id FROM configurations WHERE key = 'notification_emails' AND module = 'system'
    `);

    if (configResult.length > 0) {
      const configId = configResult[0].id;

      // Delete the config setting
      await queryRunner.query(`
        DELETE FROM config_settings WHERE "configId" = '${configId}'
      `);
    }

    // Delete the configuration
    await queryRunner.query(`
      DELETE FROM configurations WHERE key = 'notification_emails' AND module = 'system'
    `);
  }
}
