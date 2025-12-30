import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedLeaveApprovalReminderThreshold1775000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert leave_approval_reminder_threshold_days configuration (number type)
    // This is used by CRON 20 (Leave Approval Reminder)
    // Leaves pending for more than this threshold are marked as "urgent"
    const thresholdConfig = {
      module: 'leave',
      key: 'leave_approval_reminder_threshold_days',
      label: 'Leave Approval Reminder Threshold Days',
      valueType: 'number',
      description:
        'Number of days after which a pending leave application is considered urgent and requires immediate attention in reminder emails',
    };

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        thresholdConfig.module,
        thresholdConfig.key,
        thresholdConfig.label,
        thresholdConfig.valueType,
        thresholdConfig.description,
      ],
    );

    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [thresholdConfig.key, thresholdConfig.module],
    );

    if (configRow) {
      // Default to 5 days - leaves pending longer are marked urgent
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [configRow.id, '5'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'leave_approval_reminder_threshold_days' AND module = 'leave'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'leave_approval_reminder_threshold_days' AND module = 'leave'`,
    );
  }
}
