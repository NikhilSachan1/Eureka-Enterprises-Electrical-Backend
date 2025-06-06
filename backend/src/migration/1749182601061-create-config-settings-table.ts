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
            name: 'config_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'context_key',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'value',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'effective_from',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'effective_to',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: false,
            default: 'NOW()',
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
        columnNames: ['config_id'],
        referencedTableName: 'configurations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_config_id',
        columnNames: ['config_id'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_context_key',
        columnNames: ['context_key'],
      }),
    );

    await queryRunner.createIndex(
      'config_settings',
      new TableIndex({
        name: 'IDX_config_settings_effective_dates',
        columnNames: ['effective_from', 'effective_to'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('config_settings');
  }
}
