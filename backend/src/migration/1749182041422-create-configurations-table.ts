import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateConfigurationsTable1749182041422 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'configurations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'module',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'key',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'label',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'value_type',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'is_editable',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'description',
            type: 'text',
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
        uniques: [
          {
            name: 'UQ_configurations_module_key',
            columnNames: ['module', 'key'],
          },
        ],
      }),
      true,
    );

    // Add check constraint for value_type
    await queryRunner.query(`
            ALTER TABLE configurations 
            ADD CONSTRAINT CHK_configurations_value_type 
            CHECK (value_type IN ('json', 'array', 'number', 'text', 'boolean'))
        `);

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'configurations',
      new TableIndex({
        name: 'IDX_configurations_module',
        columnNames: ['module'],
      }),
    );

    await queryRunner.createIndex(
      'configurations',
      new TableIndex({
        name: 'IDX_configurations_key',
        columnNames: ['key'],
      }),
    );

    await queryRunner.createIndex(
      'configurations',
      new TableIndex({
        name: 'IDX_configurations_is_editable',
        columnNames: ['is_editable'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('configurations');
  }
}
