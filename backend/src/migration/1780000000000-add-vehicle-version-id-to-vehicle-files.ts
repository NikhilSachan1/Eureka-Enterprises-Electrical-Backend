import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddVehicleVersionIdToVehicleFiles1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'vehicles_files',
      new TableColumn({
        name: 'vehicleVersionId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'vehicles_files',
      new TableIndex({
        name: 'idx_vehicles_files_vehicle_version_id',
        columnNames: ['vehicleVersionId'],
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        name: 'fk_vehicles_files_vehicle_version_id',
        columnNames: ['vehicleVersionId'],
        referencedTableName: 'vehicle_versions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('vehicles_files', 'fk_vehicles_files_vehicle_version_id');
    await queryRunner.dropIndex('vehicles_files', 'idx_vehicles_files_vehicle_version_id');
    await queryRunner.dropColumn('vehicles_files', 'vehicleVersionId');
  }
}
