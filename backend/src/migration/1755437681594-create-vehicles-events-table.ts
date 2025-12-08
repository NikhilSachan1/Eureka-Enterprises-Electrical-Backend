import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateVehiclesEventsTable1755437681594 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'vehicles_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'vehicleId', type: 'uuid', isNullable: false },
          { name: 'eventType', type: 'varchar', isNullable: false },
          { name: 'fromUser', type: 'uuid', isNullable: true },
          { name: 'toUser', type: 'uuid', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
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

    // Create foreign key constraints
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
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['fromUser'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['toUser'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'vehicles_events',
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes for the table
    await queryRunner.createIndex(
      'vehicles_events',
      new TableIndex({
        name: 'idx_vehicles_events_vehicle_id',
        columnNames: ['vehicleId'],
      }),
    );

    await queryRunner.createIndex(
      'vehicles_events',
      new TableIndex({
        name: 'idx_vehicles_events_from_user',
        columnNames: ['fromUser'],
      }),
    );

    await queryRunner.createIndex(
      'vehicles_events',
      new TableIndex({
        name: 'idx_vehicles_events_to_user',
        columnNames: ['toUser'],
      }),
    );

    await queryRunner.createIndex(
      'vehicles_events',
      new TableIndex({
        name: 'idx_vehicles_events_created_by',
        columnNames: ['createdBy'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('vehicles_events');
  }
}
