import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateUserPermissionsTable1749184757606 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_permission_overrides',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'permissionId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'isGranted',
            type: 'boolean',
            isNullable: false,
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
        uniques: [
          {
            name: 'UQ_user_permission_overrides_user_permission',
            columnNames: ['userId', 'permissionId'],
          },
        ],
      }),
      true,
    );

    // Create foreign key relationships
    await queryRunner.createForeignKey(
      'user_permission_overrides',
      new TableForeignKey({
        name: 'FK_user_permission_overrides_user_id',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_permission_overrides',
      new TableForeignKey({
        name: 'FK_user_permission_overrides_permission_id',
        columnNames: ['permissionId'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign key relationships for audit fields
    await queryRunner.createForeignKey(
      'user_permission_overrides',
      new TableForeignKey({
        name: 'FK_user_permission_overrides_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_permission_overrides',
      new TableForeignKey({
        name: 'FK_user_permission_overrides_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_permission_overrides',
      new TableForeignKey({
        name: 'FK_user_permission_overrides_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'user_permission_overrides',
      new TableIndex({
        name: 'IDX_user_permission_overrides_user_id',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'user_permission_overrides',
      new TableIndex({
        name: 'IDX_user_permission_overrides_permission_id',
        columnNames: ['permissionId'],
      }),
    );

    await queryRunner.createIndex(
      'user_permission_overrides',
      new TableIndex({
        name: 'IDX_user_permission_overrides_is_granted',
        columnNames: ['isGranted'],
      }),
    );

    await queryRunner.createIndex(
      'user_permission_overrides',
      new TableIndex({
        name: 'IDX_user_permission_overrides_created_by',
        columnNames: ['createdBy'],
      }),
    );

    await queryRunner.createIndex(
      'user_permission_overrides',
      new TableIndex({
        name: 'IDX_user_permission_overrides_deleted_at',
        columnNames: ['deletedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_permission_overrides');
  }
}
