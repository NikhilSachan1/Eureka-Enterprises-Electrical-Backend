import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateUserDocumentsTable1760000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create user_documents table
    await queryRunner.createTable(
      new Table({
        name: 'user_documents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'documentType',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'fileKey',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'fileName',
            type: 'varchar',
            length: '255',
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
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'user_documents',
      new TableIndex({
        name: 'idx_user_documents_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'user_documents',
      new TableIndex({
        name: 'idx_user_documents_documentType',
        columnNames: ['documentType'],
      }),
    );

    await queryRunner.createIndex(
      'user_documents',
      new TableIndex({
        name: 'idx_user_documents_userId_documentType',
        columnNames: ['userId', 'documentType'],
      }),
    );

    // Create foreign key to users table
    await queryRunner.createForeignKey(
      'user_documents',
      new TableForeignKey({
        name: 'fk_user_documents_userId',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.dropForeignKey('user_documents', 'fk_user_documents_userId');

    // Drop indexes
    await queryRunner.dropIndex('user_documents', 'idx_user_documents_userId_documentType');
    await queryRunner.dropIndex('user_documents', 'idx_user_documents_documentType');
    await queryRunner.dropIndex('user_documents', 'idx_user_documents_userId');

    // Drop table
    await queryRunner.dropTable('user_documents');
  }
}
