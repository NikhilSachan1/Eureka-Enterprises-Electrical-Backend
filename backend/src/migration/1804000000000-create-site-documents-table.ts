import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSiteDocumentsTable1804000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create site_documents table
    await queryRunner.createTable(
      new Table({
        name: 'site_documents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'siteId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'contractorId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'documentType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'direction',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'documentNumber',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'documentDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'gstAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalAmount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'fileUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'fileName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'DRAFT'",
          },
          {
            name: 'paymentStatus',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          {
            name: 'paymentDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'paymentReference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'dueDate',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'remarks',
            type: 'text',
            isNullable: true,
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
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_SITE',
        columnNames: ['siteId'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_CONTRACTOR',
        columnNames: ['contractorId'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_TYPE',
        columnNames: ['documentType'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_DIRECTION',
        columnNames: ['direction'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_PAYMENT_STATUS',
        columnNames: ['paymentStatus'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_NUMBER',
        columnNames: ['documentNumber'],
      }),
    );

    await queryRunner.createIndex(
      'site_documents',
      new TableIndex({
        name: 'IDX_SITE_DOCUMENT_DUE_DATE',
        columnNames: ['dueDate'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'site_documents',
      new TableForeignKey({
        name: 'FK_SITE_DOCUMENT_SITE',
        columnNames: ['siteId'],
        referencedTableName: 'sites',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'site_documents',
      new TableForeignKey({
        name: 'FK_SITE_DOCUMENT_CONTRACTOR',
        columnNames: ['contractorId'],
        referencedTableName: 'contractors',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('site_documents', 'FK_SITE_DOCUMENT_CONTRACTOR');
    await queryRunner.dropForeignKey('site_documents', 'FK_SITE_DOCUMENT_SITE');

    // Drop indexes
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_DUE_DATE');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_NUMBER');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_PAYMENT_STATUS');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_STATUS');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_DIRECTION');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_TYPE');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_CONTRACTOR');
    await queryRunner.dropIndex('site_documents', 'IDX_SITE_DOCUMENT_SITE');

    // Drop table
    await queryRunner.dropTable('site_documents');
  }
}
