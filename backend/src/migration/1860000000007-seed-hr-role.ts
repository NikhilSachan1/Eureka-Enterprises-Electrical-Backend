import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the HR role (referenced by the payment-sheet approval flow's HR_REVIEW stage)
 * and grant it the payment-sheet review/view/download permissions. Idempotent.
 */
const HR_PERMS = [
  'financials.payment-sheets.review',
  'financials.payment-sheets.view',
  'financials.payment-sheets.download',
];

export class SeedHrRole1860000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO roles (name, label, description, "isEditable", "isDeletable")
      VALUES ('HR', 'HR', 'Human Resources — reviews payment sheets', false, false)
      ON CONFLICT (name) DO NOTHING
    `);

    await queryRunner.query(
      `
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name = 'HR' AND p.name = ANY($1) AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
      `,
      [HR_PERMS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "roleId" IN (SELECT id FROM roles WHERE name = 'HR')
        AND "permissionId" IN (SELECT id FROM permissions WHERE name LIKE 'financials.payment-sheets.%')
    `);
    // Only drop HR if this migration's seed is unused (no users assigned).
    await queryRunner.query(`
      DELETE FROM roles
      WHERE name = 'HR' AND id NOT IN (SELECT "roleId" FROM user_roles)
    `);
  }
}
