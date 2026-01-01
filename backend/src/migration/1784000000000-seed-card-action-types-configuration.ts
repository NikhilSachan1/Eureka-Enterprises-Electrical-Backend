import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCardActionTypesConfiguration1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const cardActionTypesConfig = {
      module: 'card',
      key: 'card_action_types',
      label: 'Card Action Types',
      valueType: 'array',
      description: 'Actions that can be performed on cards (Assign/Unassign to vehicles)',
      values: [
        { value: 'ASSIGN', label: 'Assign to Vehicle' },
        { value: 'UNASSIGN', label: 'Unassign from Vehicle' },
      ],
    };

    // Insert configuration
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        cardActionTypesConfig.module,
        cardActionTypesConfig.key,
        cardActionTypesConfig.label,
        cardActionTypesConfig.valueType,
        cardActionTypesConfig.description,
      ],
    );

    // Get the configuration id
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [cardActionTypesConfig.key, cardActionTypesConfig.module],
    );

    if (configRow) {
      // Insert config settings with the values
      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [configRow.id, JSON.stringify(cardActionTypesConfig.values)],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = 'card_action_types' AND module = 'card'
       )`,
    );

    // Delete configuration
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = 'card_action_types' AND module = 'card'`,
    );
  }
}
