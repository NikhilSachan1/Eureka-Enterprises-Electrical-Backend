import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed Financial Configuration Settings
 * 
 * This migration seeds the configuration values for the financial modules:
 * - Vendor types (FREELANCER, GST_REGISTERED)
 * - Party types (SALE, PURCHASE)
 * - Financial document approval statuses (PENDING, APPROVED, REJECTED)
 * - GST types (GST-1, GST-3B)
 * - TDS payment categories (CONTRACTOR, VENDOR)
 * - Payment advice reference prefix (EE/TA)
 * - Financial years (rolling)
 * 
 * Uses the existing configurations + config_settings pattern.
 */
export class SeedFinancialConfigSettings1836000000000 implements MigrationInterface {
  name = 'SeedFinancialConfigSettings1836000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get the system user ID for createdBy
    const systemUserResult = await queryRunner.query(`
      SELECT id FROM users WHERE email = 'system@internal.com' LIMIT 1
    `);
    const systemUserId = systemUserResult[0]?.id || null;

    // Helper to insert a configuration parent row and its config_settings
    // value array. The `configurations` table requires non-null `label` and
    // `valueType` (see configuration.entity.ts) — both were missing from the
    // first version of this migration, which caused a NOT NULL violation
    // on `label` and aborted the run. ON CONFLICT targets `(module, key)`
    // because that is the actual unique constraint at the table level
    // (UQ_configurations_module_key in 1749182041422-create-configurations-table.ts);
    // the @Column unique flag in the entity is an entity-level hint that
    // doesn't override the migration's composite constraint.
    const insertConfigWithSettings = async (
      key: string,
      module: string,
      label: string,
      description: string,
      values: Array<{ value: string; label: string }>,
    ) => {
      const configResult = await queryRunner.query(
        `
        INSERT INTO configurations
          (id, key, module, label, "valueType", description, "createdBy", "createdAt", "updatedAt")
        VALUES (uuid_generate_v4(), $1, $2, $3, 'array', $4, $5, NOW(), NOW())
        ON CONFLICT (module, key) DO UPDATE
          SET label = EXCLUDED.label,
              "valueType" = EXCLUDED."valueType",
              description = EXCLUDED.description,
              "updatedAt" = NOW()
        RETURNING id
      `,
        [key, module, label, description, systemUserId],
      );

      const configId = configResult[0]?.id;

      if (configId) {
        // Replace any existing setting rows for this config so reruns are idempotent.
        await queryRunner.query(`DELETE FROM config_settings WHERE "configId" = $1`, [
          configId,
        ]);
        await queryRunner.query(
          `
          INSERT INTO config_settings
            (id, "configId", value, "isActive", "createdBy", "createdAt", "updatedAt")
          VALUES (uuid_generate_v4(), $1, $2::jsonb, true, $3, NOW(), NOW())
        `,
          [configId, JSON.stringify(values), systemUserId],
        );
      }
    };

    // 1. Vendor Types
    await insertConfigWithSettings(
      'VENDOR_TYPES',
      'VENDOR',
      'Vendor Types',
      'Types of vendors (FREELANCER, GST_REGISTERED)',
      [
        { value: 'FREELANCER', label: 'Freelancer' },
        { value: 'GST_REGISTERED', label: 'GST Registered' },
      ],
    );

    // 2. Party Types (for financial documents)
    await insertConfigWithSettings(
      'PARTY_TYPES',
      'FINANCIALS',
      'Party Types',
      'Party types for financial documents (SALE, PURCHASE)',
      [
        { value: 'SALE', label: 'Sale (Contractor pays us)' },
        { value: 'PURCHASE', label: 'Purchase (We pay vendor)' },
      ],
    );

    // 3. Financial Document Approval Statuses
    await insertConfigWithSettings(
      'FINANCIAL_APPROVAL_STATUSES',
      'FINANCIALS',
      'Financial Document Approval Statuses',
      'Approval statuses for financial documents (PENDING, APPROVED, REJECTED)',
      [
        { value: 'PENDING', label: 'Pending Approval' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
    );

    // 4. GST Types
    await insertConfigWithSettings(
      'GST_TYPES',
      'FINANCIALS',
      'GST Types',
      'GST register types (GST-1 for sale output, GST-3B for purchase input)',
      [
        { value: 'GST-1', label: 'GST-1 (Sale / Output)' },
        { value: 'GST-3B', label: 'GST-3B (Purchase / Input)' },
      ],
    );

    // 5. TDS Payment Categories
    await insertConfigWithSettings(
      'TDS_PAYMENT_CATEGORIES',
      'FINANCIALS',
      'TDS Payment Categories',
      'TDS payment categories (CONTRACTOR, VENDOR)',
      [
        { value: 'CONTRACTOR', label: 'Contractor (Sale side)' },
        { value: 'VENDOR', label: 'Vendor (Purchase side)' },
      ],
    );

    // 6. Payment Advice Reference Prefix
    await insertConfigWithSettings(
      'PAYMENT_ADVICE_REFERENCE_PREFIX',
      'FINANCIALS',
      'Payment Advice Reference Prefix',
      'Prefix for payment advice reference numbers (e.g., EE/TA)',
      [{ value: 'EE/TA', label: 'EE/TA' }],
    );

    // 7. Financial Years (current and next few)
    const currentYear = new Date().getFullYear();
    const financialYears = [];
    for (let i = -1; i <= 5; i++) {
      const startYear = currentYear + i;
      const endYear = (startYear + 1) % 100;
      const fyCode = `${startYear % 100}${endYear.toString().padStart(2, '0')}`;
      financialYears.push({
        value: fyCode,
        label: `FY ${startYear}-${startYear + 1}`,
      });
    }

    await insertConfigWithSettings(
      'FINANCIAL_YEARS',
      'FINANCIALS',
      'Financial Years',
      'Available financial years for financial documents',
      financialYears,
    );

    // 8. Note Sides (for debit/credit notes)
    await insertConfigWithSettings(
      'NOTE_SIDES',
      'FINANCIALS',
      'Note Sides',
      'Note sides for debit/credit notes (SALE, PURCHASE)',
      [
        { value: 'SALE', label: 'Debit Note (Sale side)' },
        { value: 'PURCHASE', label: 'Credit Note (Purchase side)' },
      ],
    );

    // 9. Update site_document_types config - remove PO and INVOICE
    // First find the config
    const docTypesConfig = await queryRunner.query(`
      SELECT id FROM configurations 
      WHERE key = 'SITE_DOCUMENT_TYPES' AND module = 'SITE'
      LIMIT 1
    `);

    if (docTypesConfig[0]?.id) {
      // Update the config settings to remove PO and INVOICE, add PHOTO and INSPECTION_REPORT
      await queryRunner.query(
        `
        UPDATE config_settings 
        SET value = $1::jsonb, "updatedAt" = NOW()
        WHERE "configId" = $2
      `,
        [
          JSON.stringify([
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'WORK_ORDER', label: 'Work Order' },
            { value: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
            { value: 'PHOTO', label: 'Photo' },
            { value: 'INSPECTION_REPORT', label: 'Inspection Report' },
            { value: 'OTHER', label: 'Other' },
          ]),
          docTypesConfig[0].id,
        ],
      );
    }

    // 10. Update site_document_statuses config - simplify to DRAFT, APPROVED, REJECTED
    const docStatusesConfig = await queryRunner.query(`
      SELECT id FROM configurations 
      WHERE key = 'SITE_DOCUMENT_STATUSES' AND module = 'SITE'
      LIMIT 1
    `);

    if (docStatusesConfig[0]?.id) {
      await queryRunner.query(
        `
        UPDATE config_settings 
        SET value = $1::jsonb, "updatedAt" = NOW()
        WHERE "configId" = $2
      `,
        [
          JSON.stringify([
            { value: 'DRAFT', label: 'Draft' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
          ]),
          docStatusesConfig[0].id,
        ],
      );
    }

    console.log('Financial configuration settings seeded successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the seeded configurations
    const configKeys = [
      'VENDOR_TYPES',
      'PARTY_TYPES',
      'FINANCIAL_APPROVAL_STATUSES',
      'GST_TYPES',
      'TDS_PAYMENT_CATEGORIES',
      'PAYMENT_ADVICE_REFERENCE_PREFIX',
      'FINANCIAL_YEARS',
      'NOTE_SIDES',
    ];

    for (const key of configKeys) {
      // Delete config settings first
      await queryRunner.query(
        `
        DELETE FROM config_settings 
        WHERE "configId" IN (
          SELECT id FROM configurations WHERE key = $1
        )
      `,
        [key],
      );

      // Delete configuration
      await queryRunner.query(
        `
        DELETE FROM configurations WHERE key = $1
      `,
        [key],
      );
    }

    // Restore site_document_types to original (with PO, INVOICE)
    const docTypesConfig = await queryRunner.query(`
      SELECT id FROM configurations 
      WHERE key = 'SITE_DOCUMENT_TYPES' AND module = 'SITE'
      LIMIT 1
    `);

    if (docTypesConfig[0]?.id) {
      await queryRunner.query(
        `
        UPDATE config_settings 
        SET value = $1::jsonb, "updatedAt" = NOW()
        WHERE "configId" = $2
      `,
        [
          JSON.stringify([
            { value: 'PO', label: 'Purchase Order' },
            { value: 'INVOICE', label: 'Invoice' },
            { value: 'CONTRACT', label: 'Contract' },
            { value: 'WORK_ORDER', label: 'Work Order' },
            { value: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
            { value: 'OTHER', label: 'Other' },
          ]),
          docTypesConfig[0].id,
        ],
      );
    }

    // Restore site_document_statuses to original
    const docStatusesConfig = await queryRunner.query(`
      SELECT id FROM configurations 
      WHERE key = 'SITE_DOCUMENT_STATUSES' AND module = 'SITE'
      LIMIT 1
    `);

    if (docStatusesConfig[0]?.id) {
      await queryRunner.query(
        `
        UPDATE config_settings 
        SET value = $1::jsonb, "updatedAt" = NOW()
        WHERE "configId" = $2
      `,
        [
          JSON.stringify([
            { value: 'DRAFT', label: 'Draft' },
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'PAID', label: 'Paid' },
          ]),
          docStatusesConfig[0].id,
        ],
      );
    }

    console.log('Financial configuration settings removed');
  }
}
