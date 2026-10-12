import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions for the common PetroCard wallet.
 *
 * Split into view and manage rather than riding on the existing `petro-card.*` card permissions:
 * adding a card and putting company money into the wallet are different authorities, and plenty of
 * people who should see the balance should not be able to record a recharge.
 *
 * Granted to the same roles that already hold `petro-card.add` — ADMIN, OPERATION_MANAGER,
 * SUPER_ADMIN — verified against the seed rather than assumed.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants.
 */
export class SeedPetroCardWalletPermissions1860000000075 implements MigrationInterface {
  name = 'SeedPetroCardWalletPermissions1860000000075';

  private static readonly GRANT_TO_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATION_MANAGER'];

  private readonly permissions: Array<[string, string, string]> = [
    [
      'petro-card.wallet-view',
      'View PetroCard Wallet',
      'View the common PetroCard wallet balance and its recharge/transaction summary',
    ],
    [
      'petro-card.wallet-manage',
      'Manage PetroCard Wallet Recharges',
      'Record, correct and delete PetroCard wallet recharge transactions',
    ],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, label, description] of this.permissions) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, 'petro_card', $2, $3, true, true, 'web'
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
      [SeedPetroCardWalletPermissions1860000000075.GRANT_TO_ROLES, names],
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
