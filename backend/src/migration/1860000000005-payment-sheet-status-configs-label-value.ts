import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reshape the payment-sheet status/stage reference configs from a plain string array
 * (seeded in 1860000000004) into a [{ label, value }] array for friendlier client use.
 */

const SHEET_STATUSES = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Returned', value: 'RETURNED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const SHEET_STAGES = [
  { label: 'Initiation', value: 'INITIATION' },
  { label: 'HR Review', value: 'HR_REVIEW' },
  { label: 'Admin Review', value: 'ADMIN_REVIEW' },
  { label: 'Processing', value: 'PROCESSING' },
];

const ITEM_STATUSES = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Hold', value: 'HOLD' },
  { label: 'Rejected', value: 'REJECTED' },
];

// Plain-array form used by 1860000000004 — for down().
const plain = (arr: Array<{ value: string }>) => arr.map((o) => o.value);

export class PaymentSheetStatusConfigsLabelValue1860000000005 implements MigrationInterface {
  private async setValue(queryRunner: QueryRunner, key: string, value: unknown): Promise<void> {
    await queryRunner.query(
      `
      UPDATE config_settings cs
      SET value = $2::jsonb, "updatedAt" = NOW()
      FROM configurations c
      WHERE c.id = cs."configId" AND c.key = $1 AND cs."deletedAt" IS NULL
      `,
      [key, JSON.stringify(value)],
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.setValue(queryRunner, 'payments.sheet_statuses', SHEET_STATUSES);
    await this.setValue(queryRunner, 'payments.sheet_stages', SHEET_STAGES);
    await this.setValue(queryRunner, 'payments.item_statuses', ITEM_STATUSES);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setValue(queryRunner, 'payments.sheet_statuses', plain(SHEET_STATUSES));
    await this.setValue(queryRunner, 'payments.sheet_stages', plain(SHEET_STAGES));
    await this.setValue(queryRunner, 'payments.item_statuses', plain(ITEM_STATUSES));
  }
}
