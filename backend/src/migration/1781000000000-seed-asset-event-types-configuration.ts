import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAssetEventTypesConfiguration1781000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const assetEventTypesConfig = {
      module: 'asset',
      key: 'asset_event_types',
      label: 'Asset Event Types',
      valueType: 'array',
      description: 'Types of events that can occur for an asset',
      values: [
        { value: 'ASSET_ADDED', label: 'Asset Added' },
        { value: 'AVAILABLE', label: 'Available' },
        { value: 'ASSIGNED', label: 'Assigned' },
        { value: 'DEALLOCATED', label: 'Deallocated' },
        { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
        { value: 'CALIBRATED', label: 'Calibrated' },
        { value: 'DAMAGED', label: 'Damaged' },
        { value: 'RETIRED', label: 'Retired' },
        { value: 'UPDATED', label: 'Updated' },
        { value: 'HANDOVER_INITIATED', label: 'Handover Initiated' },
        { value: 'HANDOVER_ACCEPTED', label: 'Handover Accepted' },
        { value: 'HANDOVER_REJECTED', label: 'Handover Rejected' },
        { value: 'HANDOVER_CANCELLED', label: 'Handover Cancelled' },
      ],
    };

    // Check if config already exists
    const existingConfig = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [assetEventTypesConfig.key, assetEventTypesConfig.module],
    );

    let configId: string;

    if (existingConfig.length === 0) {
      // Insert configuration
      const [inserted] = await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         RETURNING id`,
        [
          assetEventTypesConfig.module,
          assetEventTypesConfig.key,
          assetEventTypesConfig.label,
          assetEventTypesConfig.valueType,
          assetEventTypesConfig.description,
        ],
      );
      configId = inserted.id;
    } else {
      configId = existingConfig[0].id;
    }

    // Check if config setting already exists
    const existingSetting = await queryRunner.query(
      `SELECT id FROM config_settings WHERE "configId" = $1`,
      [configId],
    );

    if (existingSetting.length === 0) {
      // Insert config settings
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [configId, JSON.stringify(assetEventTypesConfig.values)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'asset_event_types' AND module = 'asset'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'asset_event_types' AND module = 'asset'`,
    );
  }
}
