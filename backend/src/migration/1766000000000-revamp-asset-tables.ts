import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAssetTables1766000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================
    // 1. CREATE asset_masters TABLE
    // ============================================
    await queryRunner.createTable(
      new Table({
        name: 'asset_masters',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'assetId',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Foreign keys for asset_masters
    await queryRunner.createForeignKeys('asset_masters', [
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // ============================================
    // 2. CREATE asset_versions TABLE
    // ============================================
    await queryRunner.createTable(
      new Table({
        name: 'asset_versions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'assetMasterId', type: 'uuid', isNullable: false },
          // Master Info
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          { name: 'model', type: 'varchar', length: '255', isNullable: true },
          { name: 'serialNumber', type: 'varchar', length: '255', isNullable: true },
          { name: 'category', type: 'varchar', length: '100', isNullable: false },
          { name: 'assetType', type: 'varchar', length: '50', isNullable: false },
          // Calibration
          { name: 'calibrationFrom', type: 'varchar', length: '100', isNullable: true },
          { name: 'calibrationFrequency', type: 'varchar', length: '50', isNullable: true },
          { name: 'calibrationStartDate', type: 'date', isNullable: true },
          { name: 'calibrationEndDate', type: 'date', isNullable: true },
          // Purchase & Warranty
          { name: 'purchaseDate', type: 'date', isNullable: true },
          { name: 'vendorName', type: 'varchar', length: '255', isNullable: true },
          { name: 'warrantyStartDate', type: 'date', isNullable: true },
          { name: 'warrantyEndDate', type: 'date', isNullable: true },
          // Status
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'AVAILABLE'",
          },
          { name: 'assignedTo', type: 'uuid', isNullable: true },
          { name: 'remarks', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'additionalData', type: 'jsonb', isNullable: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Foreign keys for asset_versions
    await queryRunner.createForeignKeys('asset_versions', [
      new TableForeignKey({
        name: 'FK_ASSET_VERSIONS_MASTER',
        columnNames: ['assetMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'asset_masters',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_ASSET_VERSIONS_ASSIGNED_TO',
        columnNames: ['assignedTo'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['updatedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['deletedBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // Indexes for asset_versions
    await queryRunner.createIndices('asset_versions', [
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_MASTER_ID', columnNames: ['assetMasterId'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_NAME', columnNames: ['name'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_CATEGORY', columnNames: ['category'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_ASSET_TYPE', columnNames: ['assetType'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_STATUS', columnNames: ['status'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_ASSIGNED_TO', columnNames: ['assignedTo'] }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_IS_ACTIVE', columnNames: ['isActive'] }),
      new TableIndex({
        name: 'IDX_ASSET_VERSIONS_CALIBRATION_END',
        columnNames: ['calibrationEndDate'],
      }),
      new TableIndex({ name: 'IDX_ASSET_VERSIONS_WARRANTY_END', columnNames: ['warrantyEndDate'] }),
    ]);

    // ============================================
    // 3. CREATE assets_events TABLE
    // ============================================
    await queryRunner.createTable(
      new Table({
        name: 'assets_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'assetMasterId', type: 'uuid', isNullable: false },
          { name: 'eventType', type: 'varchar', length: '50', isNullable: false },
          { name: 'fromUser', type: 'uuid', isNullable: true },
          { name: 'toUser', type: 'uuid', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Foreign keys for assets_events
    await queryRunner.createForeignKeys('assets_events', [
      new TableForeignKey({
        columnNames: ['assetMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'asset_masters',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['fromUser'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['toUser'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // Indexes for assets_events
    await queryRunner.createIndices('assets_events', [
      new TableIndex({ name: 'IDX_ASSETS_EVENTS_MASTER_ID', columnNames: ['assetMasterId'] }),
      new TableIndex({ name: 'IDX_ASSETS_EVENTS_FROM_USER', columnNames: ['fromUser'] }),
      new TableIndex({ name: 'IDX_ASSETS_EVENTS_TO_USER', columnNames: ['toUser'] }),
      new TableIndex({ name: 'IDX_ASSETS_EVENTS_EVENT_TYPE', columnNames: ['eventType'] }),
    ]);

    // ============================================
    // 4. CREATE assets_files TABLE
    // ============================================
    await queryRunner.createTable(
      new Table({
        name: 'assets_files',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'assetMasterId', type: 'uuid', isNullable: false },
          { name: 'fileType', type: 'varchar', length: '50', isNullable: false },
          { name: 'fileKey', type: 'varchar', length: '500', isNullable: false },
          { name: 'label', type: 'varchar', length: '255', isNullable: true },
          { name: 'assetEventsId', type: 'uuid', isNullable: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Foreign keys for assets_files
    await queryRunner.createForeignKeys('assets_files', [
      new TableForeignKey({
        columnNames: ['assetMasterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'asset_masters',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['assetEventsId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'assets_events',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    ]);

    // Indexes for assets_files
    await queryRunner.createIndices('assets_files', [
      new TableIndex({ name: 'IDX_ASSETS_FILES_MASTER_ID', columnNames: ['assetMasterId'] }),
      new TableIndex({ name: 'IDX_ASSETS_FILES_EVENTS_ID', columnNames: ['assetEventsId'] }),
      new TableIndex({ name: 'IDX_ASSETS_FILES_FILE_TYPE', columnNames: ['fileType'] }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('assets_files', true, true, true);
    await queryRunner.dropTable('assets_events', true, true, true);
    await queryRunner.dropTable('asset_versions', true, true, true);
    await queryRunner.dropTable('asset_masters', true, true, true);
  }
}
