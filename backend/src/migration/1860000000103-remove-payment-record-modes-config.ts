import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops `payments.record_modes` (seeded by the since-removed 1860000000102). The Reimburse /
 * Bank Transfer record mode is a frontend app setting (APP_CONFIG.PAYMENT_RECORD_CONFIG), not a
 * Configurations entry. A no-op where 102 never ran.
 */
const KEY = 'payments.record_modes';

export class RemovePaymentRecordModesConfig1860000000103 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM config_settings WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [KEY],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [KEY]);
  }

  public async down(): Promise<void> {
    // Nothing to restore — the config is intentionally gone.
  }
}
