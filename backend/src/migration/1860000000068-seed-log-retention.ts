import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Log retention cleanup.
 *
 * 1. Seeds the `log_retention` config — the on/off switch and the per-table day counts. **Disabled**,
 *    because the first enabled run deletes hundreds of thousands of rows.
 * 2. Adds the `createdAt` indexes the cleanup needs. `entity_audit_logs` and `request_audit_logs`
 *    had none, so every pass would otherwise sequential-scan half a million rows — twice per batch.
 *
 * The day counts here are the starting point, not a rule: they are editable from the configuration
 * screen. `cron_logs` is 90 because `POST /admin/cron/trigger` reads it for its "already run?" and
 * dependency checks — the scheduled jobs themselves never read it.
 */
export class SeedLogRetention1860000000068 implements MigrationInterface {
  name = 'SeedLogRetention1860000000068';

  private static readonly CONFIG_KEY = 'log_retention';

  private static readonly VALUE = {
    enabled: false,
    batchSize: 5000,
    maxBatchesPerTable: 40,
    tables: {
      communication_logs: 15,
      request_audit_logs: 7,
      entity_audit_logs: 7,
      cron_logs: 90,
      payment_advice_email_logs: 60,
    },
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Indexes. Without them the nightly pass is a repeated full scan of the two biggest tables.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_entity_audit_logs_created_at"
         ON "entity_audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_request_audit_logs_created_at"
         ON "request_audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cron_logs_created_at" ON "cron_logs" ("createdAt")`,
    );

    // 2. The config.
    const existing = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = 'system'`,
      [SeedLogRetention1860000000068.CONFIG_KEY],
    );

    let configId: string;
    if (existing.length === 0) {
      const [inserted] = await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ('system', $1, 'Log Retention', 'json', $2, true, NOW(), NOW())
         RETURNING id`,
        [
          SeedLogRetention1860000000068.CONFIG_KEY,
          'How many days of each log table to keep. enabled=false disables the cleanup entirely. ' +
            'Only the tables listed here are ever touched, and the list is fixed in code.',
        ],
      );
      configId = inserted.id;
    } else {
      configId = existing[0].id;
    }

    const existingSetting = await queryRunner.query(
      `SELECT id FROM config_settings WHERE "configId" = $1`,
      [configId],
    );
    if (existingSetting.length === 0) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [configId, JSON.stringify(SeedLogRetention1860000000068.VALUE)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1 AND module = 'system')`,
      [SeedLogRetention1860000000068.CONFIG_KEY],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1 AND module = 'system'`, [
      SeedLogRetention1860000000068.CONFIG_KEY,
    ]);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_entity_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_request_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cron_logs_created_at"`);
  }
}
