import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateGstPaymentAdviceSequencesTable1834000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'gst_payment_advice_sequences',
        columns: [
          {
            name: 'financialYear',
            type: 'varchar',
            length: '10',
            isPrimary: true,
          },
          {
            name: 'lastSeq',
            type: 'integer',
            default: 0,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('gst_payment_advice_sequences');
  }
}
