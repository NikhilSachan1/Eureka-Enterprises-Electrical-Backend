import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Display copy of the UTR on a payment-sheet line, stamped at pay time (vendor: bank transfer
 * UTR; expense/fuel: transactionId). The authoritative record stays in bank_transfers / the
 * settlement expense entry. See docs (UTR column on payment sheet PDF).
 */
export class AddUtrNumberToPaymentSheetItems1860000000026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payment_sheet_items',
      new TableColumn({ name: 'utrNumber', type: 'varchar', length: '500', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('payment_sheet_items', 'utrNumber');
  }
}
