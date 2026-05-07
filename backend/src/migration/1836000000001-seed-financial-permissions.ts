import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed financial module permissions per §8 of the plan.
 */
export class SeedFinancialPermissions1836000000001 implements MigrationInterface {
  private readonly permissions = [
    // Purchase Orders
    { name: 'financials.purchase-orders.view', label: 'View Purchase Orders', module: 'financials' },
    { name: 'financials.purchase-orders.create', label: 'Create Purchase Orders', module: 'financials' },
    { name: 'financials.purchase-orders.update', label: 'Update Purchase Orders', module: 'financials' },
    { name: 'financials.purchase-orders.delete', label: 'Delete Purchase Orders', module: 'financials' },
    { name: 'financials.purchase-orders.approve', label: 'Approve / Reject Purchase Orders', module: 'financials' },
    { name: 'financials.purchase-orders.unlock', label: 'Grant Unlock Requests for POs', module: 'financials' },

    // JMCs
    { name: 'financials.jmcs.view', label: 'View JMCs', module: 'financials' },
    { name: 'financials.jmcs.create', label: 'Create JMCs', module: 'financials' },
    { name: 'financials.jmcs.update', label: 'Update JMCs', module: 'financials' },
    { name: 'financials.jmcs.delete', label: 'Delete JMCs', module: 'financials' },
    { name: 'financials.jmcs.approve', label: 'Approve / Reject JMCs', module: 'financials' },
    { name: 'financials.jmcs.unlock', label: 'Grant Unlock Requests for JMCs', module: 'financials' },

    // Site Reports
    { name: 'financials.site-reports.view', label: 'View Site Reports', module: 'financials' },
    { name: 'financials.site-reports.create', label: 'Create Site Reports', module: 'financials' },
    { name: 'financials.site-reports.update', label: 'Update Site Reports', module: 'financials' },
    { name: 'financials.site-reports.delete', label: 'Delete Site Reports', module: 'financials' },

    // Invoices
    { name: 'financials.invoices.view', label: 'View Invoices', module: 'financials' },
    { name: 'financials.invoices.create', label: 'Create Invoices', module: 'financials' },
    { name: 'financials.invoices.update', label: 'Update Invoices', module: 'financials' },
    { name: 'financials.invoices.delete', label: 'Delete Invoices', module: 'financials' },
    { name: 'financials.invoices.approve', label: 'Approve / Reject Invoices', module: 'financials' },
    { name: 'financials.invoices.unlock', label: 'Grant Unlock Requests for Invoices', module: 'financials' },

    // Book Payments
    { name: 'financials.book-payments.view', label: 'View Book Payments', module: 'financials' },
    { name: 'financials.book-payments.create', label: 'Create Book Payments', module: 'financials' },
    { name: 'financials.book-payments.update', label: 'Update Book Payments', module: 'financials' },
    { name: 'financials.book-payments.delete', label: 'Delete Book Payments', module: 'financials' },

    // Bank Transfers
    { name: 'financials.bank-transfers.view', label: 'View Bank Transfers', module: 'financials' },
    { name: 'financials.bank-transfers.create', label: 'Create Bank Transfers', module: 'financials' },
    { name: 'financials.bank-transfers.update', label: 'Update Bank Transfers', module: 'financials' },
    { name: 'financials.bank-transfers.delete', label: 'Delete Bank Transfers', module: 'financials' },

    // Payment Advices
    { name: 'financials.payment-advices.view', label: 'View Payment Advices', module: 'financials' },
    { name: 'financials.payment-advices.email', label: 'Send Payment Advice Email', module: 'financials' },

    // Debit/Credit Notes
    { name: 'financials.notes.view', label: 'View Debit/Credit Notes', module: 'financials' },
    { name: 'financials.notes.create', label: 'Create Debit/Credit Notes', module: 'financials' },
    { name: 'financials.notes.update', label: 'Update Debit/Credit Notes', module: 'financials' },
    { name: 'financials.notes.delete', label: 'Delete Debit/Credit Notes', module: 'financials' },

    // GST
    { name: 'financials.gst.view', label: 'View GST Register', module: 'financials' },
    { name: 'financials.gst.verify', label: 'Verify GST Register Entries', module: 'financials' },
    { name: 'financials.gst.revert', label: 'Revert GST Verification', module: 'financials' },
    { name: 'financials.gst.release-payment', label: 'Release Monthly GST Payment', module: 'financials' },

    // TDS
    { name: 'financials.tds.view', label: 'View TDS Register', module: 'financials' },
    { name: 'financials.tds.verify', label: 'Verify TDS Register Entries', module: 'financials' },
    { name: 'financials.tds.revert', label: 'Revert TDS Verification', module: 'financials' },
    { name: 'financials.tds.release-payment', label: 'Release Monthly TDS Payment', module: 'financials' },

    // Billing
    { name: 'financials.billing.view', label: 'View Billing Summaries', module: 'financials' },

    // Universal View
    { name: 'financials.universal-view', label: 'Cross-site Financial Visibility', module: 'financials' },

    // Vendors
    { name: 'financials.vendors.view', label: 'View Vendors', module: 'financials' },
    { name: 'financials.vendors.create', label: 'Create Vendors', module: 'financials' },
    { name: 'financials.vendors.update', label: 'Update Vendors', module: 'financials' },
    { name: 'financials.vendors.delete', label: 'Delete Vendors', module: 'financials' },

    // Sites Close
    { name: 'sites.close', label: 'Close Site with Financial Clearance', module: 'sites' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const perm of this.permissions) {
      await queryRunner.query(
        `
          INSERT INTO permissions (id, name, label, module, "createdAt", "updatedAt")
          VALUES (uuid_generate_v4(), $1, $2, $3, NOW(), NOW())
          ON CONFLICT (name) DO NOTHING
        `,
        [perm.name, perm.label, perm.module],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = this.permissions.map((p) => p.name);
    await queryRunner.query(
      `DELETE FROM permissions WHERE name = ANY($1)`,
      [names],
    );
  }
}
