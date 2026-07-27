import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Payment Request — a project-wise request to pay against an invoice. On approval (with an
 * optional amount adjustment) a book_payment is auto-created for the approved amount, which then
 * flows into the payment sheet. Invoice-linked (book_payment requires an invoice).
 */
export class CreatePaymentRequestsTable1860000000036 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'invoiceId', type: 'uuid' },
          { name: 'siteId', type: 'uuid' }, // denormalized (project-wise filtering)
          { name: 'poId', type: 'uuid' },
          { name: 'requestedAmount', type: 'numeric', precision: 15, scale: 2 },
          { name: 'approvedAmount', type: 'numeric', precision: 15, scale: 2, isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'PENDING'" },
          { name: 'reason', type: 'text', isNullable: true },
          { name: 'bookPaymentId', type: 'uuid', isNullable: true }, // set on approval
          { name: 'approvalBy', type: 'uuid', isNullable: true },
          { name: 'approvalAt', type: 'timestamptz', isNullable: true },
          { name: 'rejectionReason', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({ name: 'IDX_PAYMENT_REQUESTS_INVOICE', columnNames: ['invoiceId'] }),
    );
    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_PAYMENT_REQUESTS_SITE_STATUS',
        columnNames: ['siteId', 'status'],
      }),
    );
    await queryRunner.createForeignKey(
      'payment_requests',
      new TableForeignKey({
        name: 'FK_PAYMENT_REQUESTS_INVOICE',
        columnNames: ['invoiceId'],
        referencedTableName: 'site_invoices',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_requests', true);
  }
}
