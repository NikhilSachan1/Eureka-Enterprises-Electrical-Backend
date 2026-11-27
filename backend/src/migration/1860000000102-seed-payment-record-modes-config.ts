import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `payments.record_modes` — how Reimburse (expense / fuel) and vendor Bank Transfer may be recorded.
 *   • both options  → the form shows a "Record Payment" dropdown (default: With Payment Sheet)
 *   • one option    → the dropdown is hidden and that mode is always used
 * PAYMENT_SHEET goes through payment-sheets/direct/* (auto-created sheet); DIRECT uses the original
 * endpoints. Editable, so an admin can narrow it to one mode from Configurations.
 */
const KEY = 'payments.record_modes';

const RECORD_MODES = [
  { label: 'With Payment Sheet', value: 'PAYMENT_SHEET' },
  { label: 'Direct (no Payment Sheet)', value: 'DIRECT' },
];

export class SeedPaymentRecordModesConfig1860000000102 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // configurations.key has only a plain index (no unique constraint) → guard with NOT EXISTS.
    await queryRunner.query(
      `
      INSERT INTO configurations (module, key, label, "valueType", "isEditable", description)
      SELECT 'payments', $1, $2, 'array', true, $3
      WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)
      `,
      [
        KEY,
        'Payment Record Modes',
        'How Reimburse and vendor Bank Transfer are recorded. Keep both to let the user choose; ' +
          'keep one to always use it (WITH a payment sheet, or DIRECT without one).',
      ],
    );

    await queryRunner.query(
      `
      INSERT INTO config_settings ("configId", "contextKey", value, "isActive")
      SELECT c.id, NULL, $2::jsonb, true
      FROM configurations c
      WHERE c.key = $1
        AND NOT EXISTS (
          SELECT 1 FROM config_settings cs WHERE cs."configId" = c.id AND cs."deletedAt" IS NULL
        )
      `,
      [KEY, JSON.stringify(RECORD_MODES)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM config_settings WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [KEY],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [KEY]);
  }
}
