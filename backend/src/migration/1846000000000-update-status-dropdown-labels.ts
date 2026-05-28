import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename "Archived" → "Inactive" in company and contractor status dropdowns.
 * "Archived" is confusing — "Inactive" better describes a company/contractor
 * that is deactivated (isActive = false) but not soft-deleted.
 */
export class UpdateStatusDropdownLabels1846000000000 implements MigrationInterface {
  name = 'UpdateStatusDropdownLabels1846000000000';

  private readonly targets = [
    { module: 'company', key: 'company_status_dropdown' },
    { module: 'contractor', key: 'contractor_status_dropdown' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { module, key } of this.targets) {
      const configResult = await queryRunner.query(
        `SELECT id FROM configurations WHERE module = $1 AND key = $2 LIMIT 1`,
        [module, key],
      );
      if (!configResult.length) continue;

      const configId = configResult[0].id;

      const settingsResult = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [configId],
      );
      if (!settingsResult.length) continue;

      const { id: settingsId, value: currentValues } = settingsResult[0];

      // Replace label "Archived" → "Inactive" for value "false"
      const updated = currentValues.map((item: any) => {
        if (item.label === 'Archived' && item.value === 'false') {
          return { ...item, label: 'Inactive' };
        }
        return item;
      });

      await queryRunner.query(
        `UPDATE config_settings SET value = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
        [JSON.stringify(updated), settingsId],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { module, key } of this.targets) {
      const configResult = await queryRunner.query(
        `SELECT id FROM configurations WHERE module = $1 AND key = $2 LIMIT 1`,
        [module, key],
      );
      if (!configResult.length) continue;

      const configId = configResult[0].id;

      const settingsResult = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "deletedAt" IS NULL LIMIT 1`,
        [configId],
      );
      if (!settingsResult.length) continue;

      const { id: settingsId, value: currentValues } = settingsResult[0];

      // Revert label "Inactive" → "Archived" for value "false"
      const reverted = currentValues.map((item: any) => {
        if (item.label === 'Inactive' && item.value === 'false') {
          return { ...item, label: 'Archived' };
        }
        return item;
      });

      await queryRunner.query(
        `UPDATE config_settings SET value = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
        [JSON.stringify(reverted), settingsId],
      );
    }
  }
}
