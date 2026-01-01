import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogsTables1787000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'request_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'correlationId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'method',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'queryParams',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'requestBody',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'requestHeaders',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'responseStatus',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'responseBody',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'responseTimeMs',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'errorStack',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'userIp',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'entity_audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'correlationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'entityName',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'entityId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'oldValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'newValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'changedFields',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'changedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_CORRELATION',
        columnNames: ['correlationId'],
      }),
    );

    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_USER',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_TIMESTAMP',
        columnNames: ['timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_STATUS',
        columnNames: ['responseStatus'],
      }),
    );

    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_METHOD_URL',
        columnNames: ['method', 'url'],
      }),
    );

    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_CORRELATION',
        columnNames: ['correlationId'],
      }),
    );

    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_ENTITY',
        columnNames: ['entityName', 'entityId'],
      }),
    );

    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_USER',
        columnNames: ['changedBy'],
      }),
    );

    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_TIMESTAMP',
        columnNames: ['timestamp'],
      }),
    );

    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_ACTION',
        columnNames: ['action'],
      }),
    );

    // Create composite index for entity history queries
    await queryRunner.createIndex(
      'entity_audit_logs',
      new TableIndex({
        name: 'IDX_ENTITY_AUDIT_ENTITY_TIMESTAMP',
        columnNames: ['entityName', 'entityId', 'timestamp'],
      }),
    );

    // Create composite index for request analytics
    await queryRunner.createIndex(
      'request_audit_logs',
      new TableIndex({
        name: 'IDX_REQUEST_AUDIT_ANALYTICS',
        columnNames: ['timestamp', 'responseStatus'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes for entity_audit_logs
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_ENTITY_TIMESTAMP');
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_ACTION');
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_TIMESTAMP');
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_USER');
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_ENTITY');
    await queryRunner.dropIndex('entity_audit_logs', 'IDX_ENTITY_AUDIT_CORRELATION');

    // Drop indexes for request_audit_logs
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_ANALYTICS');
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_METHOD_URL');
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_STATUS');
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_TIMESTAMP');
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_USER');
    await queryRunner.dropIndex('request_audit_logs', 'IDX_REQUEST_AUDIT_CORRELATION');

    // Drop tables
    await queryRunner.dropTable('entity_audit_logs');
    await queryRunner.dropTable('request_audit_logs');
  }
}
