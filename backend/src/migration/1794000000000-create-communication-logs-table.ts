import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCommunicationLogsTable1794000000000 implements MigrationInterface {
  name = 'CreateCommunicationLogsTable1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create communication_logs table
    await queryRunner.createTable(
      new Table({
        name: 'communication_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '50',
            isNullable: false,
            comment: 'EMAIL, WHATSAPP, SMS, PUSH_NOTIFICATION',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
            comment: 'PENDING, SENT, DELIVERED, FAILED, BOUNCED, READ',
          },
          {
            name: 'category',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment:
              'ATTENDANCE_APPROVAL, EXPENSE_APPROVAL, FUEL_EXPENSE_APPROVAL, LEAVE_APPROVAL, etc.',
          },
          {
            name: 'priority',
            type: 'varchar',
            length: '20',
            default: "'NORMAL'",
            comment: 'LOW, NORMAL, HIGH, URGENT',
          },
          {
            name: 'recipientId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'recipientContact',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'recipientName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'subject',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'templateName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'templateData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'messageContent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'referenceId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'referenceType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'externalMessageId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorCode',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'errorDetails',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'maxRetries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'nextRetryAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'sentAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deliveredAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'readAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'responseTimeMs',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'initiatedFromIp',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_channel',
        columnNames: ['channel'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_category',
        columnNames: ['category'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_recipient_id',
        columnNames: ['recipientId'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_created_at',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_channel_status',
        columnNames: ['channel', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'communication_logs',
      new TableIndex({
        name: 'idx_comm_logs_reference',
        columnNames: ['referenceId', 'referenceType'],
      }),
    );

    // Add foreign key constraints
    await queryRunner.createForeignKey(
      'communication_logs',
      new TableForeignKey({
        name: 'FK_comm_logs_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'communication_logs',
      new TableForeignKey({
        name: 'FK_comm_logs_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'communication_logs',
      new TableForeignKey({
        name: 'FK_comm_logs_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'communication_logs',
      new TableForeignKey({
        name: 'FK_comm_logs_recipient_id',
        columnNames: ['recipientId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.dropForeignKey('communication_logs', 'FK_comm_logs_recipient_id');
    await queryRunner.dropForeignKey('communication_logs', 'FK_comm_logs_deleted_by');
    await queryRunner.dropForeignKey('communication_logs', 'FK_comm_logs_updated_by');
    await queryRunner.dropForeignKey('communication_logs', 'FK_comm_logs_created_by');

    // Drop indexes
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_reference');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_channel_status');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_created_at');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_recipient_id');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_category');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_status');
    await queryRunner.dropIndex('communication_logs', 'idx_comm_logs_channel');

    // Drop table
    await queryRunner.dropTable('communication_logs');
  }
}
