import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable line-item reject for HR & Admin (in addition to Accounts). See
 * docs/hr-item-reject-spec.md.
 *   1. Patch the `payments.approval_flow` config: add `rejectItems: true` to the HR_REVIEW
 *      and ADMIN_REVIEW stages (read-modify-write so we preserve whatever else is there,
 *      e.g. the PROCESSING role set by 1860000000006).
 *   2. Grant `financials.payment-sheets.item-reject` to HR, ADMIN, ACCOUNTS, SUPER_ADMIN.
 */
export class EnableReviewItemReject1860000000023 implements MigrationInterface {
  private readonly REJECT_PERM = 'financials.payment-sheets.item-reject';
  private readonly REJECT_ROLES = ['HR', 'ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];
  private readonly REVIEW_STAGES = ['HR_REVIEW', 'ADMIN_REVIEW'];

  private async patchFlow(queryRunner: QueryRunner, rejectItems: boolean): Promise<void> {
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
        if (this.REVIEW_STAGES.includes(stage?.stage)) {
          if (rejectItems) stage.rejectItems = true;
          else delete stage.rejectItems;
        }
      }
      await queryRunner.query(
        `UPDATE config_settings SET value = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
        [JSON.stringify(flow), row.id],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.patchFlow(queryRunner, true);
    await queryRunner.query(
      `
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name = ANY($1)
        AND p.name = $2
        AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
      `,
      [this.REJECT_ROLES, this.REJECT_PERM],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.patchFlow(queryRunner, false);
    await queryRunner.query(
      `
      DELETE FROM role_permissions
      WHERE "roleId" IN (SELECT id FROM roles WHERE name = ANY($1))
        AND "permissionId" IN (SELECT id FROM permissions WHERE name = $2)
      `,
      [this.REJECT_ROLES, this.REJECT_PERM],
    );
  }
}
