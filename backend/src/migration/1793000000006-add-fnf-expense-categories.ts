import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add FNF-related expense categories:
 * - LEAVE_ENCASHMENT: Auto-credited when leave is encashed (FNF or regular)
 * - FNF_SETTLEMENT: For admin to manually credit FNF net payable
 * - FNF_GRATUITY: For admin to manually credit gratuity amount
 */
export class AddFnfExpenseCategories1793000000006 implements MigrationInterface {
  name = 'AddFnfExpenseCategories1793000000006';

  private readonly newCategories = [
    {
      name: 'LEAVE_ENCASHMENT',
      label: 'Leave Encashment',
      description: 'Payment for encashed leave balance',
      icon: 'calendar-check',
      isSystemGenerated: true,
      allowedRoles: ['ADMIN', 'HR'],
    },
    {
      name: 'FNF_SETTLEMENT',
      label: 'FNF Settlement',
      description: 'Full & Final Settlement payment',
      icon: 'file-invoice-dollar',
      isSystemGenerated: false,
      allowedRoles: ['ADMIN', 'HR'],
    },
    {
      name: 'FNF_GRATUITY',
      label: 'FNF Gratuity',
      description: 'Gratuity payment as part of FNF',
      icon: 'gift',
      isSystemGenerated: false,
      allowedRoles: ['ADMIN', 'HR'],
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get expense_categories config
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'expense_categories' AND module = 'expense'`,
    );

    if (!configRow) {
      // If expense_categories doesn't exist, create it with FNF categories
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", "isEditable", description, "createdAt", "updatedAt")
         VALUES ('expense', 'expense_categories', 'Expense Categories', 'array', true, 'Available expense categories including FNF-related', NOW(), NOW())`,
      );

      const [newConfigRow] = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = 'expense_categories' AND module = 'expense'`,
      );

      await queryRunner.query(
        `INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, true, NOW(), NOW())`,
        [newConfigRow.id, JSON.stringify(this.newCategories)],
      );
    } else {
      // Get current categories and add new ones
      const [settingsRow] = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
        [configRow.id],
      );

      if (settingsRow) {
        // Handle both string and already-parsed object
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

        // Add new categories if they don't exist (preserves existing)
        for (const newCat of this.newCategories) {
          const exists = currentCategories.some((cat: any) => cat.name === newCat.name);
          if (!exists) {
            currentCategories.push(newCat);
          }
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
        // Handle both string and already-parsed object
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

        // Remove only FNF categories (preserves existing)
        const categoriesToRemove = ['LEAVE_ENCASHMENT', 'FNF_SETTLEMENT', 'FNF_GRATUITY'];
        const filteredCategories = currentCategories.filter(
          (cat: any) => !categoriesToRemove.includes(cat.name),
        );

        await queryRunner.query(
          `UPDATE config_settings SET value = $1, "updatedAt" = NOW() WHERE id = $2`,
          [JSON.stringify(filteredCategories), settingsRow.id],
        );
      }
    }
  }
}
