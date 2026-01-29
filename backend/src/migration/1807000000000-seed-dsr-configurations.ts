import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDsrConfigurations1807000000000 implements MigrationInterface {
  private async insertConfigWithSettings(
    queryRunner: QueryRunner,
    config: {
      key: string;
      module: string;
      label: string;
      valueType: string;
      description: string;
      isEditable: boolean;
    },
    values: any,
  ): Promise<void> {
    // Insert configuration
    await queryRunner.query(
      `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (module, key) DO NOTHING`,
      [
        config.module,
        config.key,
        config.label,
        config.valueType,
        config.description,
        config.isEditable,
      ],
    );

    // Get the configuration id
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
      [config.key, config.module],
    );

    if (configRow) {
      // Check if config setting already exists
      const [existingSetting] = await queryRunner.query(
        `SELECT id FROM config_settings WHERE "configId" = $1`,
        [configRow.id],
      );

      // Insert config settings only if it doesn't exist
      if (!existingSetting) {
        await queryRunner.query(
          `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, true, NOW(), NOW())`,
          [configRow.id, JSON.stringify(values)],
        );
      }
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed DSR weather conditions configuration
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'dsr_weather_conditions',
        module: 'site',
        label: 'DSR Weather Conditions',
        valueType: 'array',
        description: 'Available weather conditions for Daily Status Reports',
        isEditable: true,
      },
      [
        { value: 'SUNNY', label: 'Sunny' },
        { value: 'RAINY', label: 'Rainy' },
        { value: 'CLOUDY', label: 'Cloudy' },
      ],
    );

    // Seed DSR edit cutoff configuration
    // Stores value and unit (days/hours/minutes) for flexibility
    await this.insertConfigWithSettings(
      queryRunner,
      {
        key: 'dsr_edit_cutoff',
        module: 'site',
        label: 'DSR Edit Cutoff',
        valueType: 'json',
        description:
          'Time period after which DSR cannot be edited. Format: { value: number, unit: "days"|"hours"|"minutes" }. Set to null for no restriction.',
        isEditable: true,
      },
      { value: 0, unit: 'days' }, // 2 days default
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const configKeys = ['dsr_weather_conditions', 'dsr_edit_cutoff'];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'site'
       )`,
      [configKeys],
    );

    // Delete configurations
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'site'`, [
      configKeys,
    ]);
  }
}
