import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCardConfigurations1771000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Define card configurations
    const cardConfigs = [
      {
        module: 'card',
        key: 'card_types',
        label: 'Card Types',
        valueType: 'array',
        description: 'Types of cards (Fuel, Toll, etc.)',
        values: [
          { value: 'PETRO_CARD', label: 'Petro Card' },
          { value: 'TOLL_CARD', label: 'Toll Card' },
          { value: 'FLEET_CARD', label: 'Fleet Card' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'card',
        key: 'card_expiry_warning_days',
        label: 'Card Expiry Warning Days',
        valueType: 'number',
        description: 'Number of days before card expiry to show warning (EXPIRING_SOON status)',
        values: 30,
      },
    ];

    // Insert configurations and their settings
    for (const config of cardConfigs) {
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
    const cardKeys = ['card_types', 'card_expiry_warning_days'];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'card'
       )`,
      [cardKeys],
    );

    // Delete configurations
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'card'`, [
      cardKeys,
    ]);
  }
}
