import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `unit` to PO line items and to the two tables that pre-fill them.
 *
 * A line item had `quantity` but no unit, so "10" was ambiguous — 10 Nos, 10 Kg and 10 Sqm were
 * indistinguishable on the PO and its PDF. Allowed values live in the `po_units` config seeded by
 * the next migration, so the list is editable without a deploy.
 *
 * Nullable on purpose: existing rows have no unit and there is no correct value to infer for them.
 * Defaulting to 'Nos' would invent data on historical POs, so old rows stay null and the PDF simply
 * prints an empty cell for them.
 *
 * `po_default_items` and `po_item_masters` get it too — otherwise a default item pre-fills without
 * a unit, and an item suggestion forgets the unit last used for that item, making the user retype
 * it every time.
 */
export class AddUnitToPoItems1860000000051 implements MigrationInterface {
  name = 'AddUnitToPoItems1860000000051';

  // Longest supplied value is 'Bundle' (6); 20 leaves room for additions via config.
  private readonly tables = ['po_items', 'po_default_items', 'po_item_masters'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "unit" varchar(20) NULL`,
      );
    }

    await queryRunner.query(
      `COMMENT ON COLUMN "po_items"."unit" IS
        'Unit of measure for quantity (Nos, Kg, Sqm, …). Allowed values come from the po_units config. Null on rows created before the field existed.'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "unit"`);
    }
  }
}
