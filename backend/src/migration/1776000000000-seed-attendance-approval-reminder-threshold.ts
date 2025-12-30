import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAttendanceApprovalReminderThreshold1776000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert attendance_approval_reminder_threshold_days configuration (number type)
    // This is used by CRON 22 (Attendance Approval Reminder)
    // For attendance, we consider ABSENT status as urgent by default
    // This threshold can be used for additional urgency logic if needed
    const thresholdConfig = {
      module: 'attendance',
      key: 'attendance_approval_reminder_threshold_days',
      label: 'Attendance Approval Reminder Threshold Days',
      valueType: 'number',
      description:
        'Number of days threshold for attendance approval reminders. ABSENT status is always marked urgent. This can be used for additional urgency filtering.',
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
      // Default to 5 days - can be used for additional urgency logic
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
         SELECT id FROM configurations WHERE key = 'attendance_approval_reminder_threshold_days' AND module = 'attendance'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'attendance_approval_reminder_threshold_days' AND module = 'attendance'`,
    );
  }
}
