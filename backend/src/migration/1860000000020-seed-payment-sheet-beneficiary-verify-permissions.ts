import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dedicated permissions for the payment-sheet item verify/unverify endpoints
 * (previously gated by the generic `.view` permission). Verification only ever
 * happens at HR_REVIEW / ADMIN_REVIEW stages, so mapped to the same roles that
 * already hold `.review` / `.admin-review`.
 */
export class SeedPaymentSheetBeneficiaryVerifyPermissions1860000000020
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.payment-sheets.benificiary-verify',   'financials', 'Verify Payment Sheet Beneficiaries',   'Verify payment sheet line items at the current review stage',   false, false, 'web'),
        ('financials.payment-sheets.benificiary-unverify', 'financials', 'Unverify Payment Sheet Beneficiaries', 'Remove verification from payment sheet line items',             false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO role_permissions ("roleId", "permissionId", "isActive")
      SELECT r.id, p.id, true
      FROM roles r, permissions p
      WHERE r.name IN ('HR', 'ADMIN', 'SUPER_ADMIN')
        AND p.name IN (
          'financials.payment-sheets.benificiary-verify',
          'financials.payment-sheets.benificiary-unverify'
        )
        AND r."deletedAt" IS NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions
      WHERE "permissionId" IN (
        SELECT id FROM permissions
        WHERE name IN (
          'financials.payment-sheets.benificiary-verify',
          'financials.payment-sheets.benificiary-unverify'
        )
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE name IN (
        'financials.payment-sheets.benificiary-verify',
        'financials.payment-sheets.benificiary-unverify'
      )
    `);
  }
}
