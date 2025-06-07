import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateRolePermissionsTable1749184751341 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'role_permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'roleId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'permissionId',
            type: 'uuid',
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
            name: 'UQ_role_permissions_role_permission',
            columnNames: ['roleId', 'permissionId'],
          },
        ],
      }),
      true,
    );

    // Create foreign key relationships
    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_role_id',
        columnNames: ['roleId'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_permission_id',
        columnNames: ['permissionId'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign key relationships for audit fields
    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'role_permissions',
      new TableForeignKey({
        name: 'FK_role_permissions_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'role_permissions',
      new TableIndex({
        name: 'IDX_role_permissions_role_id',
        columnNames: ['roleId'],
      }),
    );

    await queryRunner.createIndex(
      'role_permissions',
      new TableIndex({
        name: 'IDX_role_permissions_permission_id',
        columnNames: ['permissionId'],
      }),
    );

    await queryRunner.createIndex(
      'role_permissions',
      new TableIndex({
        name: 'IDX_role_permissions_created_by',
        columnNames: ['createdBy'],
      }),
    );

    await queryRunner.createIndex(
      'role_permissions',
      new TableIndex({
        name: 'IDX_role_permissions_deleted_at',
        columnNames: ['deletedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('role_permissions');
  }
}
