import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `petro_card` to the fuel `payment_modes` config.
 *
 * Without this the wallet cannot be used at all. A fuel entry is identified as a petro-card fill by
 * `paymentMode = 'petro_card'` — that is what every fuel balance query already keys on
 * (`paymentMode <> 'petro_card'`, to keep company card spend out of the employee's own ledger), and
 * what the "card required for this payment mode" guard in fuel create reads. But `validatePaymentMode`
 * checks the submitted mode against this config list, which did not contain `petro_card`, so the
 * value could never be submitted and that guard was unreachable.
 *
 * Appended to whatever is configured rather than replacing it, and skipped if already present, so
 * an environment that has since added the mode by hand is left alone.
 */
export class SeedPetroCardPaymentMode1860000000076 implements MigrationInterface {
  name = 'SeedPetroCardPaymentMode1860000000076';

  private static readonly MODE = { name: 'petro_card', label: 'Petro Card' };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE config_settings cs
         SET value = cs.value || $1::jsonb
        FROM configurations c
       WHERE c.id = cs."configId"
         AND c.module = 'fuel_expense'
         AND c.key = 'payment_modes'
         AND cs."isActive" = true
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(cs.value) AS e
            WHERE e->>'name' = $2
         )
      `,
      [JSON.stringify([SeedPetroCardPaymentMode1860000000076.MODE]), 'petro_card'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE config_settings cs
         SET value = (
           SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
             FROM jsonb_array_elements(cs.value) AS e
            WHERE e->>'name' <> $1
         )
        FROM configurations c
       WHERE c.id = cs."configId"
         AND c.module = 'fuel_expense'
         AND c.key = 'payment_modes'
         AND cs."isActive" = true
      `,
      ['petro_card'],
    );
  }
}
