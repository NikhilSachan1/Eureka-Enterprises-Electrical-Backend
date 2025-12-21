import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class EnhanceVehicleVersions1767000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to vehicle_versions
    await queryRunner.addColumns('vehicle_versions', [
      // Fuel Type
      new TableColumn({
        name: 'fuelType',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      // Purchase Info
      new TableColumn({
        name: 'purchaseDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'dealerName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      // Insurance
      new TableColumn({
        name: 'insuranceStartDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'insuranceEndDate',
        type: 'date',
        isNullable: true,
      }),
      // PUC
      new TableColumn({
        name: 'pucStartDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'pucEndDate',
        type: 'date',
        isNullable: true,
      }),
      // Fitness
      new TableColumn({
        name: 'fitnessStartDate',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'fitnessEndDate',
        type: 'date',
        isNullable: true,
      }),
      // Status & Assignment
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '50',
        isNullable: false,
        default: "'AVAILABLE'",
      }),
      new TableColumn({
        name: 'assignedTo',
        type: 'uuid',
        isNullable: true,
      }),
      // Remarks
      new TableColumn({
        name: 'remarks',
        type: 'text',
        isNullable: true,
      }),
    ]);

    // Add foreign key for assignedTo
    await queryRunner.createForeignKey(
      'vehicle_versions',
      new TableForeignKey({
        name: 'FK_VEHICLE_VERSIONS_ASSIGNED_TO',
        columnNames: ['assignedTo'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Add indexes
    await queryRunner.createIndices('vehicle_versions', [
      new TableIndex({ name: 'IDX_VEHICLE_VERSIONS_FUEL_TYPE', columnNames: ['fuelType'] }),
      new TableIndex({ name: 'IDX_VEHICLE_VERSIONS_STATUS', columnNames: ['status'] }),
      new TableIndex({ name: 'IDX_VEHICLE_VERSIONS_ASSIGNED_TO', columnNames: ['assignedTo'] }),
      new TableIndex({
        name: 'IDX_VEHICLE_VERSIONS_INSURANCE_END',
        columnNames: ['insuranceEndDate'],
      }),
      new TableIndex({ name: 'IDX_VEHICLE_VERSIONS_PUC_END', columnNames: ['pucEndDate'] }),
      new TableIndex({ name: 'IDX_VEHICLE_VERSIONS_FITNESS_END', columnNames: ['fitnessEndDate'] }),
    ]);

    // Add label column to vehicles_files (like assets_files)
    const hasLabelColumn = await queryRunner.hasColumn('vehicles_files', 'label');
    if (!hasLabelColumn) {
      await queryRunner.addColumn(
        'vehicles_files',
        new TableColumn({
          name: 'label',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop label from vehicles_files
    const hasLabelColumn = await queryRunner.hasColumn('vehicles_files', 'label');
    if (hasLabelColumn) {
      await queryRunner.dropColumn('vehicles_files', 'label');
    }

    // Drop indexes
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_FITNESS_END');
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_PUC_END');
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_INSURANCE_END');
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_ASSIGNED_TO');
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_STATUS');
    await queryRunner.dropIndex('vehicle_versions', 'IDX_VEHICLE_VERSIONS_FUEL_TYPE');

    // Drop foreign key
    await queryRunner.dropForeignKey('vehicle_versions', 'FK_VEHICLE_VERSIONS_ASSIGNED_TO');

    // Drop columns
    await queryRunner.dropColumn('vehicle_versions', 'remarks');
    await queryRunner.dropColumn('vehicle_versions', 'assignedTo');
    await queryRunner.dropColumn('vehicle_versions', 'status');
    await queryRunner.dropColumn('vehicle_versions', 'fitnessEndDate');
    await queryRunner.dropColumn('vehicle_versions', 'fitnessStartDate');
    await queryRunner.dropColumn('vehicle_versions', 'pucEndDate');
    await queryRunner.dropColumn('vehicle_versions', 'pucStartDate');
    await queryRunner.dropColumn('vehicle_versions', 'insuranceEndDate');
    await queryRunner.dropColumn('vehicle_versions', 'insuranceStartDate');
    await queryRunner.dropColumn('vehicle_versions', 'dealerName');
    await queryRunner.dropColumn('vehicle_versions', 'purchaseDate');
    await queryRunner.dropColumn('vehicle_versions', 'fuelType');
  }
}
