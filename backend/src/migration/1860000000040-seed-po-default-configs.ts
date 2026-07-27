import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PO default Terms & Conditions — managed via the app config system (`configurations` /
 * `config_settings`, module `purchase_order`, key `po_default_terms`, valueType `text`) so it is
 * editable via the standard config-settings admin UI/API. Pre-fills a new PO's editable
 * `termsAndConditions` field on the FE. Idempotent (NOT EXISTS guards).
 *
 * (Default line items remain in the `po_default_items` table — see migration ...035.)
 */
const DEFAULT_TERMS = `1. Contractor Scope
The following shall be arranged by the contractor at his own cost: skilled and unskilled manpower, site supervision, tools and tackles, accommodation and food, local transportation, safety PPEs, and temporary power arrangements required for execution.

2. Measurement & Billing
Billing shall be based on actual work executed. Measurement and verification shall be carried out jointly by the Eureka representative and the PMC representative. Work completion percentage and payable amount shall be finalized after mutual verification and discussion with authorized representatives. Only verified quantities shall be eligible for payment. 2% TDS will be deducted and reflected in 26AS. Any site expenses, if incurred, will be deducted.

3. Schedule
The contractor shall complete the work as per the project schedule provided by Eureka.

4. Revisit Clause
If additional mobilization is required due to the contractor's incomplete work or planning issues, all associated expenses shall be borne by the contractor. If remobilization is required due to project schedule changes beyond the contractor's control, transportation and accommodation expenses for the second visit shall be borne by Eureka.

5. Quality & Safety
All work shall be executed as per applicable standards, approved drawings and site instructions. Any defective work shall be rectified by the contractor at no extra cost. The contractor shall be solely responsible for the safety compliance of his workforce.

6. Back-to-Back Condition
This work order is issued against the work awarded to Eureka by the client and shall be executed on a back-to-back basis. Any change in scope, schedule or project requirements from the client side shall be binding on the contractor.`;

export class SeedPoDefaultTermsConfig1860000000040 implements MigrationInterface {
  private readonly KEY = 'po_default_terms';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       SELECT 'purchase_order', $1, 'PO Default Terms & Conditions', 'text',
              'Default Terms & Conditions template pre-filled on a new Purchase Order', true, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM configurations WHERE key = $1)`,
      [this.KEY],
    );
    const [cfg] = await queryRunner.query(`SELECT id FROM configurations WHERE key = $1`, [
      this.KEY,
    ]);
    if (cfg) {
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         SELECT $1, $2::jsonb, true, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM config_settings WHERE "configId" = $1)`,
        [cfg.id, JSON.stringify(DEFAULT_TERMS)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM config_settings WHERE "configId" IN (SELECT id FROM configurations WHERE key = $1)`,
      [this.KEY],
    );
    await queryRunner.query(`DELETE FROM configurations WHERE key = $1`, [this.KEY]);
  }
}
