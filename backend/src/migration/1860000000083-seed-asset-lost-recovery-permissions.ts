import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for the asset lost / recovered flow, plus the missing `LOST` asset status option.
 *
 * Until now the three endpoints (`GET /assets/lost`, `POST /assets/:id/mark-lost`,
 * `POST /assets/:id/mark-recovered`) were gated by a hard-coded role check
 * (SUPER_ADMIN, ADMIN, HR). These keys move them onto the permission system so the grant can be
 * managed from the permission screen like every other asset action.
 *
 * Granted to exactly the roles the old role check allowed, so nobody gains or loses access when
 * this runs.
 *
 * The `module` is copied from the existing `asset.add` permission (falling back to 'asset') so the
 * new keys sit in the same group on the permission screen, whatever that module is called in a
 * given environment.
 *
 * `asset_statuses` was seeded in 2025 without `LOST`, although `AssetStatus.LOST` is what the
 * mark-lost flow writes. Without the option the frontend shows a blank status for lost assets and
 * cannot filter by it. It is appended only when absent, so an admin-curated list is kept.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants, and the status is
 * appended only when missing.
 */
export class SeedAssetLostRecoveryPermissions1860000000083 implements MigrationInterface {
  name = 'SeedAssetLostRecoveryPermissions1860000000083';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

  private static readonly LOST_STATUS = { value: 'LOST', label: 'Lost' };

  private readonly permissions: Array<[string, string, string]> = [
    [
      'asset.lost-list',
      'View Lost Assets',
      'View the list of assets currently marked as lost, with previous assignee and recovery amount',
    ],
    [
      'asset.mark-lost',
      'Mark Asset as Lost',
      'Mark an asset as lost and optionally recover its cost from the previous assignee',
    ],
    [
      'asset.mark-recovered',
      'Mark Asset as Recovered',
      'Mark a lost asset as recovered and optionally refund the amount recovered from the employee',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, label, description] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1,
                COALESCE(
                  (SELECT module FROM permissions WHERE name = 'asset.add' AND "deletedAt" IS NULL LIMIT 1),
                  'asset'
                ),
                $2, $3, true, true, 'web'
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
      [SeedAssetLostRecoveryPermissions1860000000083.GRANT_TO_ROLES, names],
    );

    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = cs.value || $1::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = 'asset_statuses'
          AND c.module = 'asset'
          AND cs."deletedAt" IS NULL
          AND jsonb_typeof(cs.value) = 'array'
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(cs.value) AS status
             WHERE status->>'value' = 'LOST')`,
      [JSON.stringify([SeedAssetLostRecoveryPermissions1860000000083.LOST_STATUS])],
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

    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = (
                SELECT COALESCE(jsonb_agg(status), '[]'::jsonb)
                  FROM jsonb_array_elements(cs.value) AS status
                 WHERE status->>'value' <> 'LOST'
              ),
              "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = 'asset_statuses'
          AND c.module = 'asset'
          AND cs."deletedAt" IS NULL
          AND jsonb_typeof(cs.value) = 'array'`,
    );
  }
}
