import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  PaymentSheetStatus,
  PaymentSheetItemStatus,
  PaymentSheetStage,
} from '../modules/payment-sheets/constants/payment-sheet.constants';

const SHEET_STATUSES = Object.values(PaymentSheetStatus);
const ITEM_STATUSES = Object.values(PaymentSheetItemStatus);
const STAGES = Object.values(PaymentSheetStage);

export class SeedPaymentSheetStatusConfigs1860000000004 implements MigrationInterface {
  private async seed(
    queryRunner: QueryRunner,
    key: string,
    label: string,
    description: string,
    value: unknown,
  ): Promise<void> {
    // configurations.key has only a plain index (no unique constraint) → guard with NOT EXISTS.
    await queryRunner.query(
      `
      INSERT INTO configurations (module, key, label, "valueType", "isEditable", description)
      SELECT 'payments', $1, $2, 'array', false, $3
      WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)
      `,
      [key, label, description],
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
      [key, JSON.stringify(value)],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.seed(
      queryRunner,
      'payments.sheet_statuses',
      'Payment Sheet Statuses',
      'Allowed payment-sheet header statuses (read-only reference for clients)',
      SHEET_STATUSES,
    );
    await this.seed(
      queryRunner,
      'payments.sheet_stages',
      'Payment Sheet Stages',
      'Workflow stage keys a sheet can sit at (read-only reference for clients)',
      STAGES,
    );
    await this.seed(
      queryRunner,
      'payments.item_statuses',
      'Payment Sheet Item Statuses',
      'Allowed per-line item statuses (read-only reference for clients)',
      ITEM_STATUSES,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM config_settings
      WHERE "configId" IN (
        SELECT id FROM configurations
        WHERE key IN ('payments.sheet_statuses', 'payments.sheet_stages', 'payments.item_statuses')
      )
    `);
    await queryRunner.query(`
      DELETE FROM configurations
      WHERE key IN ('payments.sheet_statuses', 'payments.sheet_stages', 'payments.item_statuses')
    `);
  }
}
