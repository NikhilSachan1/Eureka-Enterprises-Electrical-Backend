import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUanToDocumentTypes1770000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get the document_types configuration
    const [config] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'document_types' AND module = 'employee'`,
    );

    if (!config) {
      Logger.error('document_types configuration not found');
      return;
    }

    // Get the active config setting
    const [configSetting] = await queryRunner.query(
      `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
      [config.id],
    );

    if (!configSetting) {
      Logger.error('document_types config setting not found');
      return;
    }

    // Parse existing values
    const existingValues = configSetting.value;

    // Check if UAN already exists
    const hasUan = existingValues.some((v: { value: string }) => v.value === 'UAN');

    if (hasUan) {
      Logger.error('UAN already exists in document_types');
      return;
    }

    // Add UAN to the values (insert after ESIC)
    const esicIndex = existingValues.findIndex((v: { value: string }) => v.value === 'ESIC');
    const newValue = { value: 'UAN', label: 'UAN Document' };

    if (esicIndex !== -1) {
      existingValues.splice(esicIndex + 1, 0, newValue);
    } else {
      existingValues.push(newValue);
    }

    // Update the config setting
    await queryRunner.query(
      `UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify(existingValues), configSetting.id],
    );

    Logger.log('Added UAN to document_types configuration');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Get the document_types configuration
    const [config] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'document_types' AND module = 'employee'`,
    );

    if (!config) return;

    // Get the active config setting
    const [configSetting] = await queryRunner.query(
      `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
      [config.id],
    );

    if (!configSetting) return;

    // Remove UAN from values
    const existingValues = configSetting.value;
    const filteredValues = existingValues.filter((v: { value: string }) => v.value !== 'UAN');

    // Update the config setting
    await queryRunner.query(
      `UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify(filteredValues), configSetting.id],
    );
  }
}
