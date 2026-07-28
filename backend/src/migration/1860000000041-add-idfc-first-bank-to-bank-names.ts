import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sync the `bank_names_dropdown` config with prod: add "IDFC FIRST Bank", which is present in
 * prod but missing in other environments (e.g. dev).
 *
 * Idempotent — appends the entry only if the array doesn't already contain `idfc_first_bank`
 * (jsonb containment). So on prod (where it already exists) this is a no-op, and on dev it adds it,
 * leaving both environments with the same 12-bank list. The stored value is a jsonb array.
 */
export class AddIdfcFirstBankToBankNames1860000000041 implements MigrationInterface {
  private readonly BANK = '{"label":"IDFC FIRST Bank","value":"idfc_first_bank"}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE config_settings cs
       SET value = cs.value || $1::jsonb, "updatedAt" = NOW()
       FROM configurations c
       WHERE c.id = cs."configId"
         AND c.key = 'bank_names_dropdown'
         AND cs."deletedAt" IS NULL
         AND NOT (cs.value @> '[{"value":"idfc_first_bank"}]'::jsonb)`,
      [`[${this.BANK}]`],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the IDFC FIRST Bank entry from the array.
    await queryRunner.query(
      `UPDATE config_settings cs
       SET value = COALESCE(
             (SELECT jsonb_agg(elem)
                FROM jsonb_array_elements(cs.value) elem
               WHERE elem->>'value' <> 'idfc_first_bank'),
             '[]'::jsonb
           ),
           "updatedAt" = NOW()
       FROM configurations c
       WHERE c.id = cs."configId"
         AND c.key = 'bank_names_dropdown'
         AND cs."deletedAt" IS NULL`,
    );
  }
}
