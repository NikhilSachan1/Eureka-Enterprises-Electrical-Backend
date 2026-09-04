import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves the vendor-code sequence to start at 10001 and renumbers existing vendors onto it, so
 * there is one continuous run instead of an old 4-digit block followed by a new 5-digit one.
 *
 *   VEN-0001 … VEN-0019   →   VEN-10001 … VEN-10019      (next new vendor: VEN-10020)
 *
 * Prefix is unchanged — only the sequence moves.
 *
 * `startFrom` is added to the config rather than relying on the renumbered data. The generator
 * derives the next code from MAX(seq)+1, which reads correctly only while rows exist: on an empty
 * vendors table (fresh env, wiped QA DB) MAX returns 0 and the next code would silently fall back
 * to VEN-0001. `startFrom` is the explicit floor, and a future "start from 20001" becomes a config
 * edit instead of another migration.
 *
 * Soft-deleted vendors are deliberately NOT renumbered. Ranges stay disjoint (live rows go to
 * 10001+, a deleted row keeps its VEN-00xx), so the partial unique index on lower("vendorCode")
 * is never violated and the freed old code is never reissued — MAX still counts the deleted row.
 *
 * That disjointness is also why a single UPDATE is safe: a plain unique index is checked per row,
 * not deferred, so a renumber whose old and new ranges overlapped would fail mid-statement.
 */
export class VendorCodeStart100011860000000054 implements MigrationInterface {
  name = 'VendorCodeStart100011860000000054';

  private static readonly CONFIG_KEY = 'vendor_code_config';
  private static readonly START_FROM = 10001;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = $2::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL`,
      [
        VendorCodeStart100011860000000054.CONFIG_KEY,
        JSON.stringify({
          prefix: 'VEN-',
          padLength: 5,
          startFrom: VendorCodeStart100011860000000054.START_FROM,
        }),
      ],
    );

    // Live rows only. `id` breaks a createdAt tie so the ordering is deterministic on re-run.
    await queryRunner.query(
      `WITH ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
           FROM vendors
          WHERE "vendorCode" IS NOT NULL
            AND "deletedAt" IS NULL
       )
       UPDATE vendors v
          SET "vendorCode" = 'VEN-' || ($1::int - 1 + o.rn)::text,
              "updatedAt" = NOW()
         FROM ordered o
        WHERE v.id = o.id`,
      [VendorCodeStart100011860000000054.START_FROM],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE config_settings cs
          SET value = $2::jsonb, "updatedAt" = NOW()
         FROM configurations c
        WHERE c.id = cs."configId"
          AND c.key = $1
          AND cs."deletedAt" IS NULL`,
      [
        VendorCodeStart100011860000000054.CONFIG_KEY,
        JSON.stringify({ prefix: 'VEN-', padLength: 4 }),
      ],
    );

    // Back to a zero-padded 4-digit sequence from 1, same ordering, so the rollback is exact.
    await queryRunner.query(
      `WITH ordered AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
           FROM vendors
          WHERE "vendorCode" IS NOT NULL
            AND "deletedAt" IS NULL
       )
       UPDATE vendors v
          SET "vendorCode" = 'VEN-' || LPAD(o.rn::text, 4, '0'),
              "updatedAt" = NOW()
         FROM ordered o
        WHERE v.id = o.id`,
    );
  }
}
