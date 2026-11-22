import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HR review becomes decrease-only, like Admin review. Raising an amount is the Operation
 * Manager's call: a reviewer who raises it would also auto-verify their own stage, and the
 * earlier OM verification would stay on an amount OM never approved. HR can still return the
 * sheet to OM when more should be paid.
 *
 * Patches the `payments.approval_flow` config read-modify-write so every other stage setting
 * (roles, verifyItems, rejectItems, …) is kept.
 */
export class PaymentSheetHrDecreaseOnly1860000000097 implements MigrationInterface {
  private async setHrAmountEdit(queryRunner: QueryRunner, policy: string): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT cs.id, cs.value
      FROM config_settings cs
      JOIN configurations c ON c.id = cs."configId"
      WHERE c.key = 'payments.approval_flow' AND cs."deletedAt" IS NULL
    `);
    for (const row of rows) {
      const flow = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (!Array.isArray(flow)) continue;
      for (const stage of flow) {
        if (stage?.stage === 'HR_REVIEW') stage.amountEdit = policy;
      }
      await queryRunner.query(
        `UPDATE config_settings SET value = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
        [JSON.stringify(flow), row.id],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.setHrAmountEdit(queryRunner, 'decrease-only');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.setHrAmountEdit(queryRunner, 'free');
  }
}
