import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ledger export is no longer PDF only: the same permission now covers every export format (the
 * PDF and the interactive file). Only the label and description change; names, grants and
 * module stay as they are.
 */
export class LedgerExportPermissionWording1860000000101 implements MigrationInterface {
  name = 'LedgerExportPermissionWording1860000000101';

  private static readonly WORDING = [
    {
      name: 'ledger.contractor.export',
      label: 'export contractor ledger',
      description: 'Export the contractor (sale) invoice ledger (PDF or interactive file)',
      oldDescription: 'Download the contractor (sale) invoice ledger as a PDF',
    },
    {
      name: 'ledger.vendor.export',
      label: 'export vendor ledger',
      description: 'Export the vendor (purchase) invoice ledger (PDF or interactive file)',
      oldDescription: 'Download the vendor (purchase) invoice ledger as a PDF',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const p of LedgerExportPermissionWording1860000000101.WORDING) {
      await queryRunner.query(
        `UPDATE permissions SET label = $2, description = $3, "updatedAt" = now() WHERE name = $1`,
        [p.name, p.label, p.description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const p of LedgerExportPermissionWording1860000000101.WORDING) {
      await queryRunner.query(
        `UPDATE permissions SET description = $2, "updatedAt" = now() WHERE name = $1`,
        [p.name, p.oldDescription],
      );
    }
  }
}
