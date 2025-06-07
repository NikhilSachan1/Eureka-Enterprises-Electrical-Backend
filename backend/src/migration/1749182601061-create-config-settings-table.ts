import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateConfigSettingsTable1749182601061 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'config_settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'configId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'contextKey',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'value',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'effectiveFrom',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'effectiveTo',
            type: 'date',
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
          {
            name: 'isActive',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
        ],
      }),
      true,
    );

    // Create foreign key relationship to configurations table
    await queryRunner.createForeignKey(
      'config_settings',
      new TableForeignKey({
        name: 'FK_config_settings_config_id',
        columnNames: ['configId'],
        referencedTableName: 'configurations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create foreign key relationships for audit fields
    await queryRunner.createForeignKey(
      'config_settings',
      new TableForeignKey({
        name: 'FK_config_settings_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'config_settings',
      new TableForeignKey({
        name: 'FK_config_settings_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'config_settings',
      new TableForeignKey({
        name: 'FK_config_settings_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_config_id',
        columnNames: ['configId'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_context_key',
        columnNames: ['contextKey'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_effective_dates',
        columnNames: ['effectiveFrom', 'effectiveTo'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_deleted_at',
        columnNames: ['deletedAt'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_created_by',
        columnNames: ['createdBy'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('config_settings');
  }
}
