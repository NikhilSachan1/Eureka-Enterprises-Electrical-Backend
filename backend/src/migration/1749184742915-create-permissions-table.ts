import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreatePermissionsTable1749184742915 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'text',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'module',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'label',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
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
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            isNullable: false,
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

    // Create foreign key relationships for audit fields
    await queryRunner.createForeignKey(
      'permissions',
      new TableForeignKey({
        name: 'FK_permissions_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'permissions',
      new TableForeignKey({
        name: 'FK_permissions_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'permissions',
      new TableForeignKey({
        name: 'FK_permissions_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_permissions_name',
        columnNames: ['name'],
      }),
    );

    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_permissions_module',
        columnNames: ['module'],
      }),
    );

    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_permissions_deleted_at',
        columnNames: ['deletedAt'],
      }),
    );

    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_permissions_created_by',
        columnNames: ['createdBy'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}
