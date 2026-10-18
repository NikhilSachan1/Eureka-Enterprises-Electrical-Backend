import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for managing delegations, and the per-module scope switch they feed.
 *
 * ## Permissions
 *
 * Managing a delegation is deciding who may enter money on somebody else's behalf, so it sits
 * with the people who already decide that sort of thing — ADMIN, HR, OPERATION_MANAGER,
 * SUPER_ADMIN, exactly as asked. Deliberately **not** granted to the manager being delegated to:
 * a person who could grant themselves members could reach the whole company by Tuesday.
 *
 * ## Scope config
 *
 * Both default to `self`, which is precisely what the hardcoded interceptor does today. The
 * feature therefore changes nothing for anybody until somebody deliberately turns it on:
 *
 *   self       only your own rows — today's behaviour
 *   delegated  your own, plus the members named in user_module_delegations
 *   all        no restriction, which is how the office roles already work
 *
 * `site` was considered and dropped: it would have meant resolving, per row, whether two people
 * shared a site on the date of the expense, and an expense carries no site history to resolve it
 * against.
 */
export class SeedDelegationPermissionsAndScope1860000000081 implements MigrationInterface {
  name = 'SeedDelegationPermissionsAndScope1860000000081';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HR', 'OPERATION_MANAGER'];

  private readonly permissions: Array<[string, string, string]> = [
    [
      'user-delegation.view-list',
      'View Delegations',
      'See who has been allowed to manage whose expense and fuel entries',
    ],
    [
      'user-delegation.manage',
      'Manage Delegations',
      'Allow one employee to add and view another employee’s entries for a module, and withdraw it',
    ],
  ];

  /** `[config module, key, label, description]` — one switch per module this applies to. */
  private readonly scopes: Array<[string, string, string, string]> = [
    [
      'expense',
      'expense_manage_scope',
      'Expense Manage Scope',
      'Whose expenses a non-office user may add and see: self, delegated or all',
    ],
    [
      'fuel_expense',
      'fuel_manage_scope',
      'Fuel Expense Manage Scope',
      'Whose fuel entries a non-office user may add and see: self, delegated or all',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, label, description] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, 'user_permission', $2, $3, true, true, 'web'
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
      [SeedDelegationPermissionsAndScope1860000000081.GRANT_TO_ROLES, names],
    );

    for (const [module, key, label, description] of this.scopes) {
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", "isEditable", description)
         SELECT $1, $2, $3, 'text', true, $4
         WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $2)`,
        [module, key, label, description],
      );
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive")
         SELECT c.id, '"self"'::jsonb, true
           FROM configurations c
          WHERE c.key = $1
            AND NOT EXISTS (SELECT 1 FROM config_settings cs WHERE cs."configId" = c.id)`,
        [key],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keys = this.scopes.map(([, key]) => key);
    await queryRunner.query(
      `DELETE FROM config_settings
        WHERE "configId" IN (SELECT id FROM configurations WHERE key = ANY($1))`,
      [keys],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1)`, [keys]);

    const names = this.permissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
