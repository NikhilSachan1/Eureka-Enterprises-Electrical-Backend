import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to:
 * 1. Add PERFORMANCE_BONUS expense category for site profit share bonuses
 * 2. Add SUPER_ADMIN to all existing categories that have ADMIN/HR in allowedRoles
 */
export class AddPerformanceBonusCategory1814000000000 implements MigrationInterface {
  name = 'AddPerformanceBonusCategory1814000000000';

  private readonly newCategory = {
    name: 'PERFORMANCE_BONUS',
    label: 'Performance Bonus',
    description: 'Site profit share performance bonus credited to employee',
    icon: 'trophy',
    isSystemGenerated: false,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'HR'],
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'expense_categories' AND module = 'expense'`,
    );

    if (!configRow) {
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", "isEditable", description, "createdAt", "updatedAt")
         VALUES ('expense', 'expense_categories', 'Expense Categories', 'array', true, 'Available expense categories', NOW(), NOW())`,
      );

      const [newConfigRow] = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = 'expense_categories' AND module = 'expense'`,
      );

      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [newConfigRow.id, JSON.stringify([this.newCategory])],
      );
    } else {
      const [settingsRow] = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
        [configRow.id],
      );

      if (settingsRow) {
        let currentCategories = [];
        if (typeof settingsRow.value === 'string') {
          try {
            currentCategories = JSON.parse(settingsRow.value);
          } catch {
            currentCategories = [];
          }
        } else if (Array.isArray(settingsRow.value)) {
          currentCategories = settingsRow.value;
        }

        // Update existing categories: add SUPER_ADMIN where ADMIN or HR exists
        currentCategories = currentCategories.map((cat: any) => {
          if (cat.allowedRoles && Array.isArray(cat.allowedRoles)) {
            const hasAdmin = cat.allowedRoles.includes('ADMIN');
            const hasHR = cat.allowedRoles.includes('HR');
            const hasSuperAdmin = cat.allowedRoles.includes('SUPER_ADMIN');

            if ((hasAdmin || hasHR) && !hasSuperAdmin) {
              return {
                ...cat,
                allowedRoles: ['SUPER_ADMIN', ...cat.allowedRoles],
              };
            }
          }
          return cat;
        });

        // Add PERFORMANCE_BONUS if it doesn't exist
        const exists = currentCategories.some((cat: any) => cat.name === this.newCategory.name);
        if (!exists) {
          currentCategories.push(this.newCategory);
        }

        await queryRunner.query(
          `UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(currentCategories), settingsRow.id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'expense_categories' AND module = 'expense'`,
    );

    if (configRow) {
      const [settingsRow] = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
        [configRow.id],
      );

      if (settingsRow) {
        let currentCategories = [];
        if (typeof settingsRow.value === 'string') {
          try {
            currentCategories = JSON.parse(settingsRow.value);
          } catch {
            currentCategories = [];
          }
        } else if (Array.isArray(settingsRow.value)) {
          currentCategories = settingsRow.value;
        }

        // Remove PERFORMANCE_BONUS category
        currentCategories = currentCategories.filter(
          (cat: any) => cat.name !== 'PERFORMANCE_BONUS',
        );

        // Remove SUPER_ADMIN from allowedRoles (revert the addition)
        currentCategories = currentCategories.map((cat: any) => {
          if (cat.allowedRoles && Array.isArray(cat.allowedRoles)) {
            return {
              ...cat,
              allowedRoles: cat.allowedRoles.filter((role: string) => role !== 'SUPER_ADMIN'),
            };
          }
          return cat;
        });

        await queryRunner.query(
          `UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(currentCategories), settingsRow.id],
        );
      }
    }
  }
}
