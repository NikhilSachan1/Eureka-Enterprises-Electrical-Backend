import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the `financials.payment-sheets.delete` permission and grant it to OPERATION_MANAGER
 * (the initiator, for abandoning their own pre-submit sheet) and SUPER_ADMIN.
 * See docs/payment-sheet-delete-spec.md.
 */
export class SeedPaymentSheetDeletePermission1860000000025 implements MigrationInterface {
  private readonly PERM = 'financials.payment-sheets.delete';
  private readonly ROLES = ['OPERATION_MANAGER', 'SUPER_ADMIN'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES ($1, 'financials', 'Delete Payment Sheet', 'Delete a payment sheet before it is submitted', false, false, 'web')
      ON CONFLICT DO NOTHING
      `,
      [this.PERM],
    );
    await queryRunner.query(
      `
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name = ANY($1) AND p.name = $2 AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
      `,
      [this.ROLES, this.PERM],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [this.PERM],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [this.PERM]);
  }
}
