import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reverting a recorded TDS challan (POST /tds/payments/:id/revert).
 *
 * The challan is soft-deleted, so it keeps who reverted it, when and why. Its entries go back to
 * "challan pending", which is what lets their invoices be unlocked again.
 *
 * Permission financials.tds.revert-challan is granted to SUPER_ADMIN and ADMIN.
 * Idempotent: IF NOT EXISTS on the columns, NOT EXISTS / ON CONFLICT on the permission.
 */
export class TdsChallanRevert1860000000096 implements MigrationInterface {
  name = 'TdsChallanRevert1860000000096';

  private static readonly PERMISSION = 'financials.tds.revert-challan';
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tds_payments
        ADD COLUMN IF NOT EXISTS "revertReason" text NULL,
        ADD COLUMN IF NOT EXISTS "revertedAt" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "revertedBy" uuid NULL
    `);

    const name = TdsChallanRevert1860000000096.PERMISSION;
    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1, 'financials', 'Revert TDS Challan',
              'Revert a recorded TDS challan so its entries go back to challan pending', false, false, 'web'
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
      [name],
    );
    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT r.id, p.id
         FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = ANY($1)
          AND r."deletedAt" IS NULL
          AND p.name = $2
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [TdsChallanRevert1860000000096.GRANT_TO_ROLES, name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const name = TdsChallanRevert1860000000096.PERMISSION;
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [name],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [name]);
    await queryRunner.query(`
      ALTER TABLE tds_payments
        DROP COLUMN IF EXISTS "revertReason",
        DROP COLUMN IF EXISTS "revertedAt",
        DROP COLUMN IF EXISTS "revertedBy"
    `);
  }
}
