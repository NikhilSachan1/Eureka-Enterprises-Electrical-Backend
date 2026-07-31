import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend the `bank_names_dropdown` config with the major Indian banks that are currently missing
 * (public sector, private, small finance, payments, foreign, and large cooperative banks).
 *
 * ADD-ONLY & idempotent: each bank is appended to the jsonb array only if its `value` is not
 * already present, so existing entries (their labels/values/order) are never modified and
 * re-running is safe. The `bank_names_dropdown` value is stored as a jsonb array.
 *
 * (IDFC FIRST Bank is handled separately in migration ...041; it is not in this list.)
 */
const NEW_BANKS: Array<{ label: string; value: string }> = [
  // ── Public sector ──
  { label: 'Punjab National Bank', value: 'pnb' },
  { label: 'Indian Bank', value: 'indian_bank' },
  { label: 'Indian Overseas Bank', value: 'indian_overseas_bank' },
  { label: 'Central Bank of India', value: 'central_bank_of_india' },
  { label: 'UCO Bank', value: 'uco_bank' },
  { label: 'Punjab & Sind Bank', value: 'punjab_and_sind_bank' },
  // ── Private sector ──
  { label: 'Kotak Mahindra Bank', value: 'kotak_mahindra_bank' },
  { label: 'IndusInd Bank', value: 'indusind_bank' },
  { label: 'Yes Bank', value: 'yes_bank' },
  { label: 'Federal Bank', value: 'federal_bank' },
  { label: 'IDBI Bank', value: 'idbi_bank' },
  { label: 'Bandhan Bank', value: 'bandhan_bank' },
  { label: 'RBL Bank', value: 'rbl_bank' },
  { label: 'South Indian Bank', value: 'south_indian_bank' },
  { label: 'Karur Vysya Bank', value: 'karur_vysya_bank' },
  { label: 'City Union Bank', value: 'city_union_bank' },
  { label: 'DCB Bank', value: 'dcb_bank' },
  { label: 'Tamilnad Mercantile Bank', value: 'tamilnad_mercantile_bank' },
  { label: 'Karnataka Bank', value: 'karnataka_bank' },
  { label: 'Jammu & Kashmir Bank', value: 'jammu_and_kashmir_bank' },
  { label: 'Dhanlaxmi Bank', value: 'dhanlaxmi_bank' },
  { label: 'CSB Bank', value: 'csb_bank' },
  // ── Small finance banks ──
  { label: 'AU Small Finance Bank', value: 'au_small_finance_bank' },
  { label: 'Equitas Small Finance Bank', value: 'equitas_small_finance_bank' },
  { label: 'Ujjivan Small Finance Bank', value: 'ujjivan_small_finance_bank' },
  { label: 'Jana Small Finance Bank', value: 'jana_small_finance_bank' },
  { label: 'Suryoday Small Finance Bank', value: 'suryoday_small_finance_bank' },
  { label: 'Utkarsh Small Finance Bank', value: 'utkarsh_small_finance_bank' },
  { label: 'ESAF Small Finance Bank', value: 'esaf_small_finance_bank' },
  { label: 'Capital Small Finance Bank', value: 'capital_small_finance_bank' },
  { label: 'Unity Small Finance Bank', value: 'unity_small_finance_bank' },
  { label: 'Shivalik Small Finance Bank', value: 'shivalik_small_finance_bank' },
  // ── Payments banks ──
  { label: 'Airtel Payments Bank', value: 'airtel_payments_bank' },
  { label: 'Jio Payments Bank', value: 'jio_payments_bank' },
  { label: 'NSDL Payments Bank', value: 'nsdl_payments_bank' },
  { label: 'Paytm Payments Bank', value: 'paytm_payments_bank' },
  // ── Foreign banks (India operations) ──
  { label: 'Citibank', value: 'citibank' },
  { label: 'HSBC', value: 'hsbc' },
  { label: 'Standard Chartered Bank', value: 'standard_chartered_bank' },
  { label: 'DBS Bank', value: 'dbs_bank' },
  { label: 'Deutsche Bank', value: 'deutsche_bank' },
  // ── Large cooperative ──
  { label: 'Saraswat Bank', value: 'saraswat_bank' },
  { label: 'Cosmos Bank', value: 'cosmos_bank' },
];

export class AddMissingBankNames1860000000042 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Append only the candidates whose `value` isn't already in the array (add-only, idempotent).
    await queryRunner.query(
      `UPDATE config_settings cs
       SET value = cs.value || COALESCE(
             (SELECT jsonb_agg(cand.elem)
                FROM jsonb_array_elements($1::jsonb) AS cand(elem)
               WHERE NOT (cs.value @> jsonb_build_array(jsonb_build_object('value', cand.elem->>'value')))),
             '[]'::jsonb
           ),
           "updatedAt" = NOW()
       FROM configurations c
       WHERE c.id = cs."configId"
         AND c.key = 'bank_names_dropdown'
         AND cs."deletedAt" IS NULL`,
      [JSON.stringify(NEW_BANKS)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove exactly the banks this migration added (preserves the original entries).
    const values = NEW_BANKS.map((b) => b.value);
    await queryRunner.query(
      `UPDATE config_settings cs
       SET value = COALESCE(
             (SELECT jsonb_agg(elem)
                FROM jsonb_array_elements(cs.value) elem
               WHERE NOT (elem->>'value' = ANY($1))),
             '[]'::jsonb
           ),
           "updatedAt" = NOW()
       FROM configurations c
       WHERE c.id = cs."configId"
         AND c.key = 'bank_names_dropdown'
         AND cs."deletedAt" IS NULL`,
      [values],
    );
  }
}
