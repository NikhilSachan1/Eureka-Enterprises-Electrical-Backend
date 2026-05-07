import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePaymentAdviceSequencesTable1832000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_advice_sequences',
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
    await queryRunner.dropTable('payment_advice_sequences');
  }
}
