import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Return to office: the holder of an asset sends it back, office staff accept or reject it.
 *
 * 1. Permissions. The holder side mirrors the handover keys and goes to the same roles; the office
 *    side (accept / reject) goes to the roles that may already deallocate an asset, since accepting
 *    a return ends the same way — the asset becomes available with nobody holding it.
 *
 *      asset.return-initiate   ← roles holding asset.handover-initiate
 *      asset.return-cancelled  ← roles holding asset.handover-cancelled
 *      asset.return-accepted   ← roles holding asset.deallocate
 *      asset.return-rejected   ← roles holding asset.deallocate
 *
 *    Grants are copied from the source permission at run time instead of a hard-coded role list,
 *    so each environment keeps whatever it has curated on the permission screen.
 *
 * 2. The four RETURN_* values are appended to the `asset_event_types` config so the event history
 *    and the asset list show a label. Only missing values are appended; an admin-curated list is
 *    kept as it is.
 *
 * The `module` is copied from the existing `asset.add` permission (falling back to 'asset') so the
 * keys sit in the same group on the permission screen.
 *
 * Idempotent: NOT EXISTS per permission, ON CONFLICT DO NOTHING on the grants, and event types are
 * appended only when absent.
 */
export class SeedAssetReturnToOffice1860000000086 implements MigrationInterface {
  name = 'SeedAssetReturnToOffice1860000000086';

  private static readonly EVENT_TYPES_CONFIG_KEY = 'asset_event_types';

  // [name, label, description, permission whose role grants are copied]
  private static readonly PERMISSIONS: Array<[string, string, string, string]> = [
    [
      'asset.return-initiate',
      'Return Asset to Office',
      'Send an asset you hold back to the office',
      'asset.handover-initiate',
    ],
    [
      'asset.return-cancelled',
      'Cancel Asset Return',
      'Cancel a return to office you started',
      'asset.handover-cancelled',
    ],
    [
      'asset.return-accepted',
      'Accept Asset Return',
      'Confirm a returned asset reached the office; it becomes available',
      'asset.deallocate',
    ],
    [
      'asset.return-rejected',
      'Reject Asset Return',
      'Reject a return to office; the asset stays with its holder',
      'asset.deallocate',
    ],
  ];

  private static readonly EVENT_TYPES = [
    { value: 'RETURN_INITIATED', label: 'Return Initiated' },
    { value: 'RETURN_ACCEPTED', label: 'Return Accepted' },
    { value: 'RETURN_REJECTED', label: 'Return Rejected' },
    { value: 'RETURN_CANCELLED', label: 'Return Cancelled' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [
      name,
      label,
      description,
      grantsFrom,
    ] of SeedAssetReturnToOffice1860000000086.PERMISSIONS) {
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

      await queryRunner.query(
        `INSERT INTO role_permissions ("roleId", "permissionId")
         SELECT DISTINCT rp."roleId", p.id
           FROM role_permissions rp
           JOIN permissions src ON src.id = rp."permissionId"
                               AND src.name = $2
                               AND src."deletedAt" IS NULL
           JOIN roles r ON r.id = rp."roleId" AND r."deletedAt" IS NULL
          CROSS JOIN permissions p
          WHERE p.name = $1
            AND p."deletedAt" IS NULL
            AND rp."isActive" = true
            AND rp."deletedAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM role_permissions x
               WHERE x."roleId" = rp."roleId" AND x."permissionId" = p.id)
         ON CONFLICT DO NOTHING`,
        [name, grantsFrom],
      );
    }

    // Append each missing RETURN_* option to the asset event types config.
    for (const option of SeedAssetReturnToOffice1860000000086.EVENT_TYPES) {
      await queryRunner.query(
        `UPDATE config_settings cs
            SET value = COALESCE(cs.value, '[]'::jsonb) || jsonb_build_array($2::jsonb),
                "updatedAt" = NOW()
           FROM configurations c
          WHERE c.id = cs."configId"
            AND c.key = $1
            AND cs."deletedAt" IS NULL
            AND jsonb_typeof(COALESCE(cs.value, '[]'::jsonb)) = 'array'
            AND NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(cs.value, '[]'::jsonb)) e
               WHERE e->>'value' = $3)`,
        [
          SeedAssetReturnToOffice1860000000086.EVENT_TYPES_CONFIG_KEY,
          JSON.stringify(option),
          option.value,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const values = SeedAssetReturnToOffice1860000000086.EVENT_TYPES.map((o) => o.value);
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = COALESCE(
                (SELECT jsonb_agg(e) FROM jsonb_array_elements(cs.value) e
                  WHERE NOT (e->>'value' = ANY($2))),
                '[]'::jsonb),
              "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL
          AND jsonb_typeof(cs.value) = 'array'`,
      [SeedAssetReturnToOffice1860000000086.EVENT_TYPES_CONFIG_KEY, values],
    );

    const names = SeedAssetReturnToOffice1860000000086.PERMISSIONS.map(([name]) => name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }
}
