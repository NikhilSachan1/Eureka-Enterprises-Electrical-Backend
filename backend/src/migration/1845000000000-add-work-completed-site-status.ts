import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add WORK_COMPLETED to site_statuses config setting.
 * This status was added to SiteStatus enum in code (commit 0b8eeb4)
 * but the config_settings entry was missed.
 *
 * WORK_COMPLETED sits between ONGOING/HOLD and COMPLETED —
 * work is physically done but financial clearance is pending.
 * Transitions: ONGOING/UPCOMING/HOLD → WORK_COMPLETED → COMPLETED | ONGOING | HOLD
 */
export class AddWorkCompletedSiteStatus1845000000000 implements MigrationInterface {
  name = 'AddWorkCompletedSiteStatus1845000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get the configId for site.site_statuses
    const configResult = await queryRunner.query(`
      SELECT id FROM configurations
      WHERE module = 'site' AND key = 'site_statuses'
      LIMIT 1
    `);

    if (!configResult.length) {
      return;
    }

    const configId = configResult[0].id;

    // Get the existing config_settings row
    const settingsResult = await queryRunner.query(
      `
      SELECT id, value FROM config_settings
      WHERE "configId" = $1
      LIMIT 1
    `,
      [configId],
    );

    if (!settingsResult.length) {
      return;
    }

    const settingsId = settingsResult[0].id;
    const currentValues: any[] = settingsResult[0].value;

    // Check if work_completed already exists (idempotent)
    const alreadyExists = currentValues.some((v: any) => v.value === 'work_completed');
    if (alreadyExists) {
      return;
    }

    // Insert WORK_COMPLETED before COMPLETED
    const completedIndex = currentValues.findIndex((v: any) => v.value === 'completed');
    const newEntry = {
      label: 'Work Completed',
      value: 'work_completed',
      description: 'Physical work done, awaiting financial clearance before closing',
    };

    if (completedIndex !== -1) {
      currentValues.splice(completedIndex, 0, newEntry);
    } else {
      currentValues.push(newEntry);
    }

    await queryRunner.query(
      `
      UPDATE config_settings
      SET value = $1::jsonb, "updatedAt" = NOW()
      WHERE id = $2
    `,
      [JSON.stringify(currentValues), settingsId],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const configResult = await queryRunner.query(`
      SELECT id FROM configurations
      WHERE module = 'site' AND key = 'site_statuses'
      LIMIT 1
    `);
    if (!configResult.length) return;

    const configId = configResult[0].id;

    const settingsResult = await queryRunner.query(
      `
      SELECT id, value FROM config_settings
      WHERE "configId" = $1
      LIMIT 1
    `,
      [configId],
    );
    if (!settingsResult.length) return;

    const settingsId = settingsResult[0].id;
    const currentValues: any[] = settingsResult[0].value;
    const filtered = currentValues.filter((v: any) => v.value !== 'work_completed');

    await queryRunner.query(
      `
      UPDATE config_settings
      SET value = $1::jsonb, "updatedAt" = NOW()
      WHERE id = $2
    `,
      [JSON.stringify(filtered), settingsId],
    );
  }
}
