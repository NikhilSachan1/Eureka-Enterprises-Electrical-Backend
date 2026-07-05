import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Split the payment-sheet controller's shared/overloaded permissions into one permission
 * per endpoint (action). See docs/payment-sheet-granular-permissions-spec.md.
 *
 * This migration ONLY manages the permission rows:
 *   - fixes the `benificiary-*` → `beneficiary-*` typo (rename keeps existing role grants);
 *   - seeds the new granular permissions;
 *   - deletes dead / superseded permissions (`review`, `admin-review`, `view`, `process`)
 *     together with any role_permissions referencing them.
 *
 * Role → permission ASSIGNMENT is intentionally out of scope and handled separately
 * (e.g. via the role-permissions admin UI). NOTE: until each new permission is granted to
 * the appropriate role, the corresponding endpoint returns 403 for everyone, because
 * PermissionsGuard fails closed.
 */
export class PaymentSheetGranularPermissions1860000000021 implements MigrationInterface {
  private readonly newPermissions: Array<[string, string, string]> = [
    // [name, label, description]
    ['financials.payment-sheets.view-list', 'List Payment Sheets', 'List payment sheets'],
    [
      'financials.payment-sheets.view-detail',
      'View Payment Sheet',
      'View a single payment sheet with items/history',
    ],
    [
      'financials.payment-sheets.reconcile',
      'Reconcile Payment Sheet',
      'View live pending vs sheet amounts',
    ],
    ['financials.payment-sheets.update', 'Edit Payment Sheet', 'Edit sheet title/remarks'],
    [
      'financials.payment-sheets.sync-amounts',
      'Sync Payment Sheet',
      'Sync line amounts to latest pending',
    ],
    [
      'financials.payment-sheets.submit',
      'Submit Payment Sheet',
      'Submit the sheet into the approval chain',
    ],
    ['financials.payment-sheets.item-add', 'Add Payment Sheet Item', 'Add a beneficiary line'],
    ['financials.payment-sheets.item-edit', 'Edit Payment Sheet Item', 'Edit a line amount'],
    [
      'financials.payment-sheets.item-remove',
      'Remove Payment Sheet Item',
      'Remove a beneficiary line',
    ],
    [
      'financials.payment-sheets.forward',
      'Forward Payment Sheet',
      'Forward to the next configured stage',
    ],
    [
      'financials.payment-sheets.return',
      'Return Payment Sheet',
      'Return the sheet to the initiator',
    ],
    [
      'financials.payment-sheets.sheet-reject',
      'Reject Payment Sheet',
      'Reject the whole sheet (terminal)',
    ],
    ['financials.payment-sheets.item-pay', 'Pay Payment Sheet Item', 'Accountant: pay a line'],
    ['financials.payment-sheets.item-hold', 'Hold Payment Sheet Item', 'Accountant: hold a line'],
    [
      'financials.payment-sheets.item-release',
      'Release Payment Sheet Item',
      'Accountant: release a held line',
    ],
    [
      'financials.payment-sheets.item-reject',
      'Reject Payment Sheet Item',
      'Accountant: reject a line (terminal)',
    ],
  ];

  private readonly deadPermissions = [
    'financials.payment-sheets.review',
    'financials.payment-sheets.admin-review',
    'financials.payment-sheets.view',
    'financials.payment-sheets.process',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Fix the `benificiary` typo. Renaming by name preserves the permission id, so any
    //    existing role_permissions / user_permission_overrides on it stay intact.
    await queryRunner.query(`
      UPDATE permissions SET name = 'financials.payment-sheets.beneficiary-verify'
      WHERE name = 'financials.payment-sheets.benificiary-verify'
    `);
    await queryRunner.query(`
      UPDATE permissions SET name = 'financials.payment-sheets.beneficiary-unverify'
      WHERE name = 'financials.payment-sheets.benificiary-unverify'
    `);

    // 2. Seed the new granular permissions (idempotent). No role mapping here.
    const values = this.newPermissions
      .map(
        ([name, label, description]) =>
          `('${name}', 'financials', '${label}', '${description}', false, false, 'web')`,
      )
      .join(',\n        ');
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ${values}
      ON CONFLICT DO NOTHING
    `);

    // 3. Remove dead / superseded permissions and their role grants.
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [this.deadPermissions],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [this.deadPermissions]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create the removed permissions (role grants are NOT restored).
    await queryRunner.query(`
      INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
      VALUES
        ('financials.payment-sheets.review',       'financials', 'Review Payment Sheets',  'HR review: edit, forward, return, reject',    false, false, 'web'),
        ('financials.payment-sheets.admin-review', 'financials', 'Admin Payment Sheets',   'Admin review: decrease, add/remove, forward', false, false, 'web'),
        ('financials.payment-sheets.view',         'financials', 'View Payment Sheets',    'View payment sheets',                         false, false, 'web'),
        ('financials.payment-sheets.process',      'financials', 'Process Payment Sheets', 'Accountant: pay, hold, release, reject',      false, false, 'web')
      ON CONFLICT DO NOTHING
    `);

    // Drop the granular permissions this migration added.
    const addedNames = this.newPermissions.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [addedNames],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [addedNames]);

    // Revert the typo fix.
    await queryRunner.query(`
      UPDATE permissions SET name = 'financials.payment-sheets.benificiary-verify'
      WHERE name = 'financials.payment-sheets.beneficiary-verify'
    `);
    await queryRunner.query(`
      UPDATE permissions SET name = 'financials.payment-sheets.benificiary-unverify'
      WHERE name = 'financials.payment-sheets.beneficiary-unverify'
    `);
  }
}
