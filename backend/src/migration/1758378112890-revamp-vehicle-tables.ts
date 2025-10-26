import { MigrationInterface, QueryRunner, TableForeignKey, TableColumn } from 'typeorm';

export class RevampVehicleTables1758378112890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing foreign keys that reference vehicles table by finding them first
    const vehiclesEventsTable = await queryRunner.getTable('vehicles_events');
    const vehiclesFilesTable = await queryRunner.getTable('vehicles_files');

    // Find and drop foreign key from vehicles_events to vehicles
    const vehiclesEventsForeignKey = vehiclesEventsTable.foreignKeys.find(
      (fk) => fk.columnNames.includes('vehicleId') && fk.referencedTableName === 'vehicles',
    );
    if (vehiclesEventsForeignKey) {
      await queryRunner.dropForeignKey('vehicles_events', vehiclesEventsForeignKey);
    }

    // Find and drop foreign key from vehicles_files to vehicles
    const vehiclesFilesForeignKey = vehiclesFilesTable.foreignKeys.find(
      (fk) => fk.columnNames.includes('vehicleId') && fk.referencedTableName === 'vehicles',
    );
    if (vehiclesFilesForeignKey) {
      await queryRunner.dropForeignKey('vehicles_files', vehiclesFilesForeignKey);
    }

    // 2. Rename vehicles table to vehicle_versions
    await queryRunner.renameTable('vehicles', 'vehicle_versions');

    // 3. Add new columns to vehicle_versions
    await queryRunner.addColumns('vehicle_versions', [
      new TableColumn({
        name: 'additionalData',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'vehicleMasterId',
        type: 'uuid',
        isNullable: false,
      }),
    ]);

    // 4. Add vehicleMasterId column to vehicles_events and vehicles_files
    await queryRunner.addColumn(
      'vehicles_events',
      new TableColumn({
        name: 'vehicleMasterId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'vehicles_files',
      new TableColumn({
        name: 'vehicleMasterId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // 5. Create foreign key constraints for the new vehicleMasterId columns
    await queryRunner.createForeignKey(
      'vehicle_versions',
      new TableForeignKey({
        columnNames: ['vehicleMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_masters',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['vehicleMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_masters',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_files',
      new TableForeignKey({
        columnNames: ['vehicleMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_masters',
        onDelete: 'CASCADE',
      }),
    );

    // 6. Drop the old vehicleId columns (after data migration if needed)
    await queryRunner.dropColumn('vehicles_events', 'vehicleId');
    await queryRunner.dropColumn('vehicles_files', 'vehicleId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the migration steps

    // 1. Add back vehicleId columns
    await queryRunner.addColumn(
      'vehicles_events',
      new TableColumn({
        name: 'vehicleId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'vehicles_files',
      new TableColumn({
        name: 'vehicleId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // 2. Drop foreign keys for vehicleMasterId by finding them
    const vehicleVersionsTable = await queryRunner.getTable('vehicle_versions');
    const vehiclesEventsTable = await queryRunner.getTable('vehicles_events');
    const vehiclesFilesTable = await queryRunner.getTable('vehicles_files');

    const vehicleVersionsFk = vehicleVersionsTable.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('vehicleMasterId') && fk.referencedTableName === 'vehicle_masters',
    );
    if (vehicleVersionsFk) {
      await queryRunner.dropForeignKey('vehicle_versions', vehicleVersionsFk);
    }

    const vehiclesEventsFk = vehiclesEventsTable.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('vehicleMasterId') && fk.referencedTableName === 'vehicle_masters',
    );
    if (vehiclesEventsFk) {
      await queryRunner.dropForeignKey('vehicles_events', vehiclesEventsFk);
    }

    const vehiclesFilesFk = vehiclesFilesTable.foreignKeys.find(
      (fk) =>
        fk.columnNames.includes('vehicleMasterId') && fk.referencedTableName === 'vehicle_masters',
    );
    if (vehiclesFilesFk) {
      await queryRunner.dropForeignKey('vehicles_files', vehiclesFilesFk);
    }

    // 3. Drop vehicleMasterId columns
    await queryRunner.dropColumn('vehicle_versions', 'vehicleMasterId');
    await queryRunner.dropColumn('vehicles_events', 'vehicleMasterId');
    await queryRunner.dropColumn('vehicles_files', 'vehicleMasterId');

    // 4. Drop additionalData column
    await queryRunner.dropColumn('vehicle_versions', 'additionalData');

    // 5. Rename table back
    await queryRunner.renameTable('vehicle_versions', 'vehicles');

    // 6. Recreate original foreign keys
    await queryRunner.createForeignKey(
      'vehicles_events',
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
        columnNames: ['vehicleId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicles',
        onDelete: 'CASCADE',
      }),
    );
  }
}
