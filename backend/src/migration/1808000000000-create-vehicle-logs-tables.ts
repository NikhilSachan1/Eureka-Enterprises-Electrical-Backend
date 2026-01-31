import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVehicleLogsTables1808000000000 implements MigrationInterface {
  name = 'CreateVehicleLogsTables1808000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create vehicle_logs table
    await queryRunner.createTable(
      new Table({
        name: 'vehicle_logs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'vehicleId', type: 'uuid', isNullable: false },
          { name: 'driverId', type: 'uuid', isNullable: false },
          { name: 'siteId', type: 'uuid', isNullable: true },
          { name: 'logDate', type: 'date', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'STARTED'",
            isNullable: false,
          },
          // Start entry
          { name: 'startOdometerReading', type: 'integer', isNullable: false },
          { name: 'startTime', type: 'time', isNullable: true },
          { name: 'startLocation', type: 'varchar', length: '255', isNullable: true },
          // End entry (nullable until completed)
          { name: 'endOdometerReading', type: 'integer', isNullable: true },
          { name: 'endTime', type: 'time', isNullable: true },
          { name: 'endLocation', type: 'varchar', length: '255', isNullable: true },
          // Calculated fields
          { name: 'totalKmTraveled', type: 'integer', isNullable: true },
          { name: 'anomalyDetected', type: 'boolean', default: false, isNullable: false },
          { name: 'anomalyReason', type: 'varchar', length: '255', isNullable: true },
          // Additional fields
          { name: 'purpose', type: 'varchar', length: '255', isNullable: true },
          { name: 'driverRemarks', type: 'text', isNullable: true },
          { name: 'odometerResetFlag', type: 'boolean', default: false, isNullable: false },
          // Base entity fields
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'NOW()', isNullable: false },
          { name: 'updatedAt', type: 'timestamp', default: 'NOW()', isNullable: false },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes for vehicle_logs
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_VEHICLE_ID', columnNames: ['vehicleId'] }),
    );
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_DRIVER_ID', columnNames: ['driverId'] }),
    );
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_SITE_ID', columnNames: ['siteId'] }),
    );
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_LOG_DATE', columnNames: ['logDate'] }),
    );
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'vehicle_logs',
      new TableIndex({ name: 'IDX_VEHICLE_LOGS_ANOMALY', columnNames: ['anomalyDetected'] }),
    );

    // Create foreign keys for vehicle_logs
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_vehicle',
        columnNames: ['vehicleId'],
        referencedTableName: 'vehicle_masters',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_driver',
        columnNames: ['driverId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_site',
        columnNames: ['siteId'],
        referencedTableName: 'sites',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_logs',
      new TableForeignKey({
        name: 'FK_vehicle_logs_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create vehicle_log_files table
    await queryRunner.createTable(
      new Table({
        name: 'vehicle_log_files',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'vehicleLogId', type: 'uuid', isNullable: false },
          { name: 'fileType', type: 'varchar', length: '50', isNullable: false },
          { name: 'fileKey', type: 'varchar', length: '500', isNullable: false },
          { name: 'fileName', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'NOW()', isNullable: false },
          { name: 'updatedAt', type: 'timestamp', default: 'NOW()', isNullable: false },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes for vehicle_log_files
    await queryRunner.createIndex(
      'vehicle_log_files',
      new TableIndex({ name: 'IDX_VEHICLE_LOG_FILES_LOG_ID', columnNames: ['vehicleLogId'] }),
    );
    await queryRunner.createIndex(
      'vehicle_log_files',
      new TableIndex({ name: 'IDX_VEHICLE_LOG_FILES_TYPE', columnNames: ['fileType'] }),
    );

    // Create foreign keys for vehicle_log_files
    await queryRunner.createForeignKey(
      'vehicle_log_files',
      new TableForeignKey({
        name: 'FK_vehicle_log_files_log',
        columnNames: ['vehicleLogId'],
        referencedTableName: 'vehicle_logs',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_log_files',
      new TableForeignKey({
        name: 'FK_vehicle_log_files_created_by',
        columnNames: ['createdBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_log_files',
      new TableForeignKey({
        name: 'FK_vehicle_log_files_updated_by',
        columnNames: ['updatedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await queryRunner.createForeignKey(
      'vehicle_log_files',
      new TableForeignKey({
        name: 'FK_vehicle_log_files_deleted_by',
        columnNames: ['deletedBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop vehicle_log_files table (indexes and FKs dropped automatically)
    await queryRunner.dropTable('vehicle_log_files', true, true, true);

    // Drop vehicle_logs table (indexes and FKs dropped automatically)
    await queryRunner.dropTable('vehicle_logs', true, true, true);
  }
}
