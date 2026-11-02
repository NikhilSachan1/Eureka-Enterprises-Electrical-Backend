import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permission for the asset retire action on the asset list. The frontend hides the action from
 * anyone without this key.
 *
 * Granted to the same roles as `asset.mark-lost` and `asset.mark-recovered`.
 *
 * The `module` is copied from the existing `asset.add` permission (falling back to 'asset') so the
 * key sits in the same group on the permission screen.
 *
 * Idempotent: NOT EXISTS on the permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedAssetRetirePermission1860000000084 implements MigrationInterface {
  name = 'SeedAssetRetirePermission1860000000084';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR'];

  private static readonly PERMISSION = 'asset.retire';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1,
              COALESCE(
                (SELECT module FROM permissions WHERE name = 'asset.add' AND "deletedAt" IS NULL LIMIT 1),
                'asset'
              ),
              $2, $3, true, true, 'web'
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
      [
        SeedAssetRetirePermission1860000000084.PERMISSION,
        'Retire Asset',
        'Permanently take an asset out of service',
      ],
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
      [
        SeedAssetRetirePermission1860000000084.GRANT_TO_ROLES,
        SeedAssetRetirePermission1860000000084.PERMISSION,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = $1)`,
      [SeedAssetRetirePermission1860000000084.PERMISSION],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = $1`, [
      SeedAssetRetirePermission1860000000084.PERMISSION,
    ]);
  }
}
