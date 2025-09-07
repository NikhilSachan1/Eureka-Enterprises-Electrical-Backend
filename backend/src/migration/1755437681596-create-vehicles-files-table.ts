import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateVehiclesFilesTable1755437681596 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vehicles_files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'vehicleId', type: 'uuid', isNullable: false },
          { name: 'fileType', type: 'varchar', isNullable: false },
          { name: 'fileKey', type: 'varchar', isNullable: false },
          { name: 'vehicleEventsId', type: 'uuid', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: false },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        columnNames: ['vehicleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicles',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        columnNames: ['vehicleEventsId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicles_events',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'vehicles_files',
      new TableIndex({
        name: 'idx_vehicles_files_vehicle_id',
        columnNames: ['vehicleId'],
      }),
    );

    await queryRunner.createIndex(
      'vehicles_files',
      new TableIndex({
        name: 'idx_vehicles_files_vehicle_events_id',
        columnNames: ['vehicleEventsId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vehicles_files');
  }
}
