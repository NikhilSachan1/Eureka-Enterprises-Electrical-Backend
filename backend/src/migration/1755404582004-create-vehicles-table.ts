import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateVehiclesTable1755404582004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vehicles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'number', type: 'varchar', isNullable: false },
          { name: 'brand', type: 'varchar', isNullable: false },
          { name: 'model', type: 'varchar', isNullable: false },
          { name: 'mileage', type: 'varchar', isNullable: false },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'vehicles',
      new TableIndex({
        name: 'idx_vehicles_number',
        columnNames: ['number'],
      }),
    );

    await queryRunner.createIndex(
      'vehicles',
      new TableIndex({
        name: 'idx_vehicles_brand',
        columnNames: ['brand'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vehicles');
  }
}
