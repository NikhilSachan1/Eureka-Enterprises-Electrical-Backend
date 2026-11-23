import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for Settings > Data Sync (prod → UAT), granted to SUPER_ADMIN only:
 *   data-sync.view — open the page / GET /data-sync/status
 *   data-sync.run  — POST /data-sync/prod-to-uat
 *
 * The sync itself still refuses unless DATA_SYNC_ENABLED=true and the database name ends in
 * "_uat", so granting these on prod shows the page but can never run a sync there.
 *
 * Idempotent: NOT EXISTS on each permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedDataSyncPermissions1860000000098 implements MigrationInterface {
  name = 'SeedDataSyncPermissions1860000000098';

  private static readonly MODULE = 'data_sync';
  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN'];
  private static readonly PERMISSIONS = [
    {
      name: 'data-sync.view',
      label: 'view data sync',
      description: 'Open the prod to UAT data sync page',
    },
    {
      name: 'data-sync.run',
      label: 'run data sync',
      description: 'Replace UAT data with masked prod data',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const { MODULE, GRANT_TO_ROLES, PERMISSIONS } = SeedDataSyncPermissions1860000000098;

    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, $2, $3, $4, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [permission.name, MODULE, permission.label, permission.description],
      );
    }

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
      [GRANT_TO_ROLES, PERMISSIONS.map((p) => p.name)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = SeedDataSyncPermissions1860000000098.PERMISSIONS.map((p) => p.name);

    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
