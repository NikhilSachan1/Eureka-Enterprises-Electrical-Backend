import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFnfExpenseSettlement1793000000005 implements MigrationInterface {
  name = 'AddFnfExpenseSettlement1793000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add expense settlement columns to fnf_settlements table
    await queryRunner.addColumns('fnf_settlements', [
      new TableColumn({
        name: 'pendingExpenseReimbursement',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'unsettledExpenseCredit',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'pendingFuelReimbursement',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'unsettledFuelCredit',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
      }),
    ]);

    // Update fnf_settings config to include expense settlement options
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'fnf_settings' AND module = 'fnf'`,
    );

    if (configRow) {
      // Get current config settings
      const [settingsRow] = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
        [configRow.id],
      );

      if (settingsRow) {
        // Handle both string and already-parsed object
        const currentValue =
          typeof settingsRow.value === 'string' ? JSON.parse(settingsRow.value) : settingsRow.value;

        // Add new expense settlement settings
        const updatedValue = {
          ...currentValue,
          expenseSettlement: {
            enabled: true,
            includeExpenses: true,
            includeFuelExpenses: true,
          },
          settlementMode: 'EXPENSE',
        };

        await queryRunner.query(`UPDATE config_settings SET value = $1 WHERE id = $2`, [
          JSON.stringify(updatedValue),
          settingsRow.id,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove expense settlement columns
    await queryRunner.dropColumns('fnf_settlements', [
      'pendingExpenseReimbursement',
      'unsettledExpenseCredit',
      'pendingFuelReimbursement',
      'unsettledFuelCredit',
    ]);

    // Revert config settings
    const [configRow] = await queryRunner.query(
      `SELECT id FROM configurations WHERE key = 'fnf_settings' AND module = 'fnf'`,
    );

    if (configRow) {
      const [settingsRow] = await queryRunner.query(
        `SELECT id, value FROM config_settings WHERE "configId" = $1 AND "isActive" = true`,
        [configRow.id],
      );

      if (settingsRow) {
        // Handle both string and already-parsed object
        const currentValue =
          typeof settingsRow.value === 'string' ? JSON.parse(settingsRow.value) : settingsRow.value;

        // Remove expense settlement settings
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { expenseSettlement, settlementMode, ...restValue } = currentValue;

        await queryRunner.query(`UPDATE config_settings SET value = $1 WHERE id = $2`, [
          JSON.stringify(restValue),
          settingsRow.id,
        ]);
      }
    }
  }
}
