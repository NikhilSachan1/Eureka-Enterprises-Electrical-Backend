import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAssetConfigurations1766000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Define asset configurations
    const assetConfigs = [
      {
        module: 'asset',
        key: 'asset_types',
        label: 'Asset Types',
        valueType: 'array',
        description: 'Types of assets - determines if calibration is required',
        values: [
          { value: 'CALIBRATED', label: 'Calibrated' },
          { value: 'NON_CALIBRATED', label: 'Non-Calibrated' },
        ],
      },
      {
        module: 'asset',
        key: 'asset_statuses',
        label: 'Asset Statuses',
        valueType: 'array',
        description: 'Available asset status options',
        values: [
          { value: 'AVAILABLE', label: 'Available' },
          { value: 'ASSIGNED', label: 'Assigned' },
          { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
          { value: 'DAMAGED', label: 'Damaged' },
          { value: 'RETIRED', label: 'Retired' },
        ],
      },
      {
        module: 'asset',
        key: 'asset_categories',
        label: 'Asset Categories',
        valueType: 'array',
        description: 'Categories of assets (IT Equipment, Tools, etc.)',
        values: [
          { value: 'IT_EQUIPMENT', label: 'IT Equipment' },
          { value: 'HAND_TOOL', label: 'Hand Tool' },
          { value: 'TESTING_TOOL', label: 'Testing Tool' },
          { value: 'MEASURING_INSTRUMENT', label: 'Measuring Instrument' },
          { value: 'SAFETY_EQUIPMENT', label: 'Safety Equipment' },
          { value: 'FURNITURE', label: 'Furniture' },
          { value: 'VEHICLE', label: 'Vehicle' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'asset',
        key: 'asset_file_types',
        label: 'Asset File Types',
        valueType: 'array',
        description: 'Types of documents/files that can be attached to assets',
        values: [
          { value: 'ASSET_IMAGE', label: 'Asset Image' },
          { value: 'CALIBRATION_CERTIFICATE', label: 'Calibration Certificate' },
          { value: 'WARRANTY_DOCUMENT', label: 'Warranty Document' },
          { value: 'PURCHASE_INVOICE', label: 'Purchase Invoice' },
          { value: 'AMC', label: 'AMC Document' },
          { value: 'REPAIR_REPORT', label: 'Repair Report' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'asset',
        key: 'calibration_sources',
        label: 'Calibration Sources',
        valueType: 'array',
        description: 'Sources/agencies that perform calibration',
        values: [
          { value: 'NABL', label: 'NABL' },
          { value: 'MANUFACTURER', label: 'Manufacturer' },
          { value: 'INTERNAL', label: 'Internal' },
          { value: 'THIRD_PARTY', label: 'Third Party' },
        ],
      },
      {
        module: 'asset',
        key: 'calibration_frequencies',
        label: 'Calibration Frequencies',
        valueType: 'array',
        description: 'How often assets need to be calibrated',
        values: [
          { value: '1_MONTH', label: '1 Month', months: 1 },
          { value: '2_MONTHS', label: '2 Months', months: 2 },
          { value: '3_MONTHS', label: '3 Months', months: 3 },
          { value: '6_MONTHS', label: '6 Months', months: 6 },
          { value: '12_MONTHS', label: '12 Months', months: 12 },
          { value: '24_MONTHS', label: '24 Months', months: 24 },
        ],
      },
    ];

    // Insert configurations and their settings
    for (const config of assetConfigs) {
      // Insert configuration
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (module, key) DO NOTHING`,
        [config.module, config.key, config.label, config.valueType, config.description],
      );

      // Get the configuration id
      const [configRow] = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
        [config.key, config.module],
      );

      if (configRow) {
        // Insert config settings with the values
        await queryRunner.query(
          `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [configRow.id, JSON.stringify(config.values)],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const assetKeys = [
      'asset_types',
      'asset_statuses',
      'asset_categories',
      'asset_file_types',
      'calibration_sources',
      'calibration_frequencies',
    ];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'asset'
       )`,
      [assetKeys],
    );

    // Delete configurations
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'asset'`, [
      assetKeys,
    ]);
  }
}
