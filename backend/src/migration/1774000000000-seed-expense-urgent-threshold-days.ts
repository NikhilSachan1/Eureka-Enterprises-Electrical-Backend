import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedExpenseUrgentThresholdDays1774000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert expense_urgent_threshold_days configuration (number type)
    // This is used by CRON 16 (Pending Expense Approval Reminders)
    // Expenses pending for more than this threshold are marked as "urgent/overdue"
    const urgentThresholdConfig = {
      module: 'expense',
      key: 'expense_urgent_threshold_days',
      label: 'Expense Urgent Threshold Days',
      valueType: 'number',
      description:
        'Number of days after which a pending expense is considered urgent/overdue and requires immediate attention',
    };

    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        urgentThresholdConfig.module,
        urgentThresholdConfig.key,
        urgentThresholdConfig.label,
        urgentThresholdConfig.valueType,
        urgentThresholdConfig.description,
      ],
    );

    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [urgentThresholdConfig.key, urgentThresholdConfig.module],
    );

    if (configRow) {
      // Default to 7 days - expenses pending longer are marked urgent
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [configRow.id, '7'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'expense_urgent_threshold_days' AND module = 'expense'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'expense_urgent_threshold_days' AND module = 'expense'`,
    );
  }
}
