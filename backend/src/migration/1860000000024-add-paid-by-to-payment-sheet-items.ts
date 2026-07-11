import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Record who marked a payment-sheet line PAID (the accountant), surfaced as `paidByUser`
 * in the GET response — mirrors `rejectedBy`. Existing `paidAt` / `paidFromAccountId` /
 * `paidAmount` already capture when / from-where / how-much.
 */
export class AddPaidByToPaymentSheetItems1860000000024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payment_sheet_items',
      new TableColumn({ name: 'paidBy', type: 'uuid', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('payment_sheet_items', 'paidBy');
  }
}
