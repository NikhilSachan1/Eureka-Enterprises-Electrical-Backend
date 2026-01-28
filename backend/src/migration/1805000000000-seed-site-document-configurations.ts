import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSiteDocumentConfigurations1805000000000 implements MigrationInterface {
  private async insertConfigWithSettings(
    queryRunner: QueryRunner,
    config: {
      key: string;
      module: string;
      label: string;
      valueType: string;
      description: string;
      isEditable: boolean;
    },
    values: object[],
  ): Promise<void> {
    // Insert configuration
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        config.module,
        config.key,
        config.label,
        config.valueType,
        config.description,
        config.isEditable,
      ],
    );

    // Get the configuration id
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [config.key, config.module],
    );

    if (configRow) {
      // Check if config setting already exists
      const [existingSetting] = await queryRunner.query(
        `SELECT id FROM config_settings WHERE "configId" = $1`,
        [configRow.id],
      );

      // Insert config settings only if it doesn't exist
      if (!existingSetting) {
        await queryRunner.query(
          `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, true, NOW(), NOW())`,
          [configRow.id, JSON.stringify(values)],
        );
      }
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed document types configuration
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'site_document_types',
        module: 'site',
        label: 'Site Document Types',
        valueType: 'array',
        description: 'Available document types for site documents (PO, Invoice, Contract, etc.)',
        isEditable: true,
      },
      [
        { value: 'PO', label: 'Purchase Order' },
        { value: 'INVOICE', label: 'Invoice' },
        { value: 'CONTRACT', label: 'Contract' },
        { value: 'WORK_ORDER', label: 'Work Order' },
        { value: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
        { value: 'OTHER', label: 'Other' },
      ],
    );

    // Seed document statuses configuration
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'site_document_statuses',
        module: 'site',
        label: 'Site Document Statuses',
        valueType: 'array',
        description: 'Available statuses for site documents',
        isEditable: false,
      },
      [
        { value: 'DRAFT', label: 'Draft' },
        { value: 'SUBMITTED', label: 'Submitted' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'PAID', label: 'Paid' },
      ],
    );

    // Seed payment statuses configuration
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'site_document_payment_statuses',
        module: 'site',
        label: 'Site Document Payment Statuses',
        valueType: 'array',
        description: 'Available payment statuses for site documents',
        isEditable: false,
      },
      [
        { value: 'PENDING', label: 'Pending' },
        { value: 'PARTIAL', label: 'Partial' },
        { value: 'PAID', label: 'Paid' },
      ],
    );

    // Seed document directions configuration
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'site_document_directions',
        module: 'site',
        label: 'Site Document Directions',
        valueType: 'array',
        description:
          'Document directions for profitability (PAYABLE = expense, RECEIVABLE = income)',
        isEditable: false,
      },
      [
        { value: 'PAYABLE', label: 'Payable (Expense)' },
        { value: 'RECEIVABLE', label: 'Receivable (Income)' },
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove config settings first
    await queryRunner.query(`
      DELETE FROM config_settings
      WHERE "configId" IN (
        SELECT id FROM configurations
        WHERE key IN ('site_document_types', 'site_document_statuses', 'site_document_payment_statuses', 'site_document_directions')
        AND module = 'site'
      )
    `);

    // Remove configurations
    await queryRunner.query(`
      DELETE FROM configurations
      WHERE key IN ('site_document_types', 'site_document_statuses', 'site_document_payment_statuses', 'site_document_directions')
      AND module = 'site'
    `);
  }
}
