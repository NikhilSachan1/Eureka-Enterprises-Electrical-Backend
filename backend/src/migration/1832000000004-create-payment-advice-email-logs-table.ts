import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePaymentAdviceEmailLogsTable1832000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_advice_email_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'paymentAdviceId', type: 'uuid' },
          { name: 'toEmails', type: 'jsonb' },
          { name: 'ccEmails', type: 'jsonb', isNullable: true },
          { name: 'subject', type: 'varchar', length: '500' },
          { name: 'body', type: 'text' },
          { name: 'attachmentKeys', type: 'jsonb', isNullable: true },
          { name: 'communicationLogId', type: 'uuid', isNullable: true },
          { name: 'sentAt', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
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
      'payment_advice_email_logs',
      new TableIndex({ name: 'IDX_PA_EMAIL_LOG_ADVICE', columnNames: ['paymentAdviceId'] }),
    );

    // Index communicationLogId for joining with the existing
    // communication_logs row (retry/delivery state lives there).
    await queryRunner.createIndex(
      'payment_advice_email_logs',
      new TableIndex({
        name: 'IDX_PA_EMAIL_LOG_COMMUNICATION',
        columnNames: ['communicationLogId'],
      }),
    );

    await queryRunner.createForeignKey(
      'payment_advice_email_logs',
      new TableForeignKey({
        columnNames: ['paymentAdviceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'payment_advices',
        onDelete: 'CASCADE',
      }),
    );

    // Plan §3.4 hardening #6 — link the email log into the existing
    // communication_logs row so DB-level integrity is enforced.
    // SET NULL (not CASCADE) so an archived comm log row never erases the
    // payment-advice send history; the audit trail must survive.
    await queryRunner.createForeignKey(
      'payment_advice_email_logs',
      new TableForeignKey({
        columnNames: ['communicationLogId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'communication_logs',
        onDelete: 'SET NULL',
      }),
    );

    for (const col of ['createdBy', 'updatedBy', 'deletedBy']) {
      await queryRunner.createForeignKey(
        'payment_advice_email_logs',
        new TableForeignKey({
          columnNames: [col],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('payment_advice_email_logs');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('payment_advice_email_logs', fk);
      }
    }
    await queryRunner.dropTable('payment_advice_email_logs');
  }
}
