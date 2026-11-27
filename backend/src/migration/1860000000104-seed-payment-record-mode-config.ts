import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `payments.record_mode` — one text value saying how Reimburse (expense / fuel) and vendor Bank
 * Transfer are recorded. Editable from Configurations. Default DIRECT.
 */
const KEY = 'payments.record_mode';
const DEFAULT_VALUE = 'DIRECT';
const DESCRIPTION =
  'NOTE: set exactly ONE of these 3 values — ' +
  'DIRECT: no dropdown, always a direct entry (no payment sheet) [default]; ' +
  'PAYMENT_SHEET: no dropdown, always creates a payment sheet; ' +
  'BOTH: shows the "Record Payment" dropdown so the user picks (pre-selected: With Payment Sheet).';

export class SeedPaymentRecordModeConfig1860000000104 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // configurations.key has only a plain index (no unique constraint) → guard with NOT EXISTS.
    await queryRunner.query(
      `
      INSERT INTO configurations (module, key, label, "valueType", "isEditable", description)
      SELECT 'payments', $1, $2, 'text', true, $3
      WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)
      `,
      [KEY, 'Payment Record Mode', DESCRIPTION],
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
      [KEY, JSON.stringify(DEFAULT_VALUE)],
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
