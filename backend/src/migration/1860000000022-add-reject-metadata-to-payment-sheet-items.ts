import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Capture who rejected a payment-sheet line, when, and at which stage — surfaced in the GET
 * response as `rejectDetail` (mirrors verification detail). See docs/hr-item-reject-spec.md.
 * `rejectReason` already exists. Reject is one-time/terminal, so single columns suffice.
 */
export class AddRejectMetadataToPaymentSheetItems1860000000022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('payment_sheet_items', [
      new TableColumn({ name: 'rejectedBy', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'rejectedAt', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'rejectStage', type: 'varchar', length: '30', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('payment_sheet_items', [
      'rejectedBy',
      'rejectedAt',
      'rejectStage',
    ]);
  }
}
