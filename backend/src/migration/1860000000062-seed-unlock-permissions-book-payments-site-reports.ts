import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Brings book-payments and site-reports in line with the JMC unlock convention.
 *
 * Five modules run the same request → grant/reject unlock workflow, but guarded it two different
 * ways. jmcs, invoices and purchase-orders use a single `<module>.unlock` for both admin actions —
 * its seeded label says so outright ("Grant Unlock Requests for JMCs"). book-payments and
 * site-reports instead used `<module>.unlock-grant` and `<module>.unlock-request-reject`, and had
 * no `.unlock` row at all.
 *
 * This seeds the two missing permissions and grants them to the same roles JMC uses, so the name
 * and the grantees both match. The controllers are repointed in the same change.
 *
 * `unlock-request` is untouched: it is on `<module>.update` in all five modules already, including
 * these two.
 *
 * Note on grantees: OPERATION_MANAGER holds `.update`, which is what lets them *request* an unlock,
 * and now also holds `.unlock`, which lets them grant one — so an OM can grant their own request on
 * these two modules. That is exactly how jmcs, invoices and purchase-orders already behave, and
 * matching them was the explicit intent ("make it in sync like jmc").
 *
 * The old `.unlock-grant` / `.unlock-request-reject` rows for these two modules become unused after
 * the repoint. They are deliberately left in place: six equivalents are already dead in the other
 * three modules, they are visible in the permission-management UI, and removing all ten belongs in
 * one deliberate cleanup rather than as a side effect here.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedUnlockPermissionsBookPaymentsSiteReports1860000000062
  implements MigrationInterface
{
  name = 'SeedUnlockPermissionsBookPaymentsSiteReports1860000000062';

  /** Same three roles that hold financials.jmcs.unlock. */
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATION_MANAGER'];

  /** Labels follow the existing rows verbatim in style: "Grant Unlock Requests for X". */
  private readonly permissions: Array<[string, string, string]> = [
    [
      'financials.book-payments.unlock',
      'Grant Unlock Requests for Book Payments',
      'Grant or reject unlock requests for approved and locked book payments',
    ],
    [
      'financials.site-reports.unlock',
      'Grant Unlock Requests for Site Reports',
      'Grant or reject unlock requests for approved and locked site reports',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, label, description] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, 'financials', $2, $3, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [name, label, description],
      );
    }

    const names = this.permissions.map(([name]) => name);

    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT r.id, p.id
         FROM roles r
        CROSS JOIN permissions p
        WHERE r.name = ANY($1)
          AND r."deletedAt" IS NULL
          AND p.name = ANY($2)
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [SeedUnlockPermissionsBookPaymentsSiteReports1860000000062.GRANT_TO_ROLES, names],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.permissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
