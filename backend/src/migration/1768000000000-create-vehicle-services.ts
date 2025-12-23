import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableColumn,
} from 'typeorm';

export class CreateVehicleServices1768000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create vehicle_services table
    await queryRunner.createTable(
      new Table({
        name: 'vehicle_services',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vehicleMasterId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'serviceDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'odometerReading',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'serviceType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'serviceDetails',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'serviceCenterName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'serviceCost',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'serviceStatus',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'PENDING'",
          },
          {
            name: 'resetsServiceInterval',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'remarks',
            type: 'text',
            isNullable: true,
          },
          // Audit columns
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
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
        ],
      }),
      true,
    );

    // Create vehicle_service_files table
    await queryRunner.createTable(
      new Table({
        name: 'vehicle_service_files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vehicleServiceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fileType',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'fileKey',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'label',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          // Audit columns
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
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
        ],
      }),
      true,
    );

    // Add lastServiceKm and lastServiceDate to vehicle_versions
    await queryRunner.addColumns('vehicle_versions', [
      new TableColumn({
        name: 'lastServiceKm',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'lastServiceDate',
        type: 'date',
        isNullable: true,
      }),
    ]);

    // Foreign keys for vehicle_services
    await queryRunner.createForeignKeys('vehicle_services', [
      new TableForeignKey({
        name: 'FK_VEHICLE_SERVICES_VEHICLE_MASTER',
        columnNames: ['vehicleMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_masters',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_VEHICLE_SERVICES_CREATED_BY',
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_VEHICLE_SERVICES_UPDATED_BY',
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // Foreign keys for vehicle_service_files
    await queryRunner.createForeignKeys('vehicle_service_files', [
      new TableForeignKey({
        name: 'FK_VEHICLE_SERVICE_FILES_SERVICE',
        columnNames: ['vehicleServiceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'vehicle_services',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_VEHICLE_SERVICE_FILES_CREATED_BY',
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // Indexes for vehicle_services
    await queryRunner.createIndices('vehicle_services', [
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICES_VEHICLE_MASTER',
        columnNames: ['vehicleMasterId'],
      }),
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICES_SERVICE_DATE',
        columnNames: ['serviceDate'],
      }),
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICES_SERVICE_TYPE',
        columnNames: ['serviceType'],
      }),
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICES_STATUS',
        columnNames: ['serviceStatus'],
      }),
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICES_ODOMETER',
        columnNames: ['odometerReading'],
      }),
    ]);

    // Indexes for vehicle_service_files
    await queryRunner.createIndex(
      'vehicle_service_files',
      new TableIndex({
        name: 'IDX_VEHICLE_SERVICE_FILES_SERVICE',
        columnNames: ['vehicleServiceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('vehicle_service_files', 'IDX_VEHICLE_SERVICE_FILES_SERVICE');
    await queryRunner.dropIndex('vehicle_services', 'IDX_VEHICLE_SERVICES_ODOMETER');
    await queryRunner.dropIndex('vehicle_services', 'IDX_VEHICLE_SERVICES_STATUS');
    await queryRunner.dropIndex('vehicle_services', 'IDX_VEHICLE_SERVICES_SERVICE_TYPE');
    await queryRunner.dropIndex('vehicle_services', 'IDX_VEHICLE_SERVICES_SERVICE_DATE');
    await queryRunner.dropIndex('vehicle_services', 'IDX_VEHICLE_SERVICES_VEHICLE_MASTER');

    // Drop foreign keys
    await queryRunner.dropForeignKey(
      'vehicle_service_files',
      'FK_VEHICLE_SERVICE_FILES_CREATED_BY',
    );
    await queryRunner.dropForeignKey('vehicle_service_files', 'FK_VEHICLE_SERVICE_FILES_SERVICE');
    await queryRunner.dropForeignKey('vehicle_services', 'FK_VEHICLE_SERVICES_UPDATED_BY');
    await queryRunner.dropForeignKey('vehicle_services', 'FK_VEHICLE_SERVICES_CREATED_BY');
    await queryRunner.dropForeignKey('vehicle_services', 'FK_VEHICLE_SERVICES_VEHICLE_MASTER');

    // Drop columns from vehicle_versions
    await queryRunner.dropColumn('vehicle_versions', 'lastServiceDate');
    await queryRunner.dropColumn('vehicle_versions', 'lastServiceKm');

    // Drop tables
    await queryRunner.dropTable('vehicle_service_files');
    await queryRunner.dropTable('vehicle_services');
  }
}
