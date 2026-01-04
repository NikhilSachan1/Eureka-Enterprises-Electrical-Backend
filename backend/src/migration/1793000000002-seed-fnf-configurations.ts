import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedFnfConfigurations1793000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const configs = [
      {
        module: 'fnf',
        key: 'fnf_settings',
        label: 'FNF Settings',
        valueType: 'json',
        description: 'Full & Final Settlement configuration settings',
        isEditable: true,
        values: {
          noticePeriod: {
            enabled: false,
            days: 30,
            recoveryEnabled: true,
            waiverAllowed: true,
          },
          gratuity: {
            enabled: false,
            minServiceYears: 5,
            formula: '15_DAYS_PER_YEAR',
            maxAmount: null,
          },
          leaveEncashment: {
            enabled: true,
            categories: ['earned'],
            paymentMode: 'EXPENSE',
            maxDays: null,
          },
          assetClearance: {
            enabled: true,
            blockFnfIfPending: true,
          },
          vehicleClearance: {
            enabled: true,
            blockFnfIfPending: true,
          },
          cardClearance: {
            enabled: true,
            blockFnfIfPending: true,
          },
          documents: {
            relievingLetter: true,
            experienceLetter: true,
            fnfStatement: true,
            autoSendEmail: true,
          },
        },
      },
      {
        module: 'fnf',
        key: 'fnf_exit_reasons',
        label: 'FNF Exit Reasons',
        valueType: 'array',
        description: 'Reasons for employee exit',
        isEditable: false,
        values: [
          { value: 'RESIGNATION', label: 'Resignation' },
          { value: 'TERMINATION', label: 'Termination' },
          { value: 'RETIREMENT', label: 'Retirement' },
          { value: 'CONTRACT_END', label: 'Contract End' },
          { value: 'ABSCONDING', label: 'Absconding' },
          { value: 'MUTUAL_SEPARATION', label: 'Mutual Separation' },
          { value: 'MEDICAL', label: 'Medical Reasons' },
          { value: 'DEATH', label: 'Death' },
        ],
      },
      {
        module: 'fnf',
        key: 'fnf_statuses',
        label: 'FNF Statuses',
        valueType: 'array',
        description: 'FNF settlement workflow statuses',
        isEditable: false,
        values: [
          { value: 'INITIATED', label: 'Initiated' },
          { value: 'CALCULATED', label: 'Calculated' },
          { value: 'PENDING_CLEARANCE', label: 'Pending Clearance' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'DOCUMENTS_GENERATED', label: 'Documents Generated' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ],
      },
      {
        module: 'fnf',
        key: 'fnf_clearance_statuses',
        label: 'FNF Clearance Statuses',
        valueType: 'array',
        description: 'Asset/Vehicle/Card clearance statuses',
        isEditable: false,
        values: [
          { value: 'PENDING', label: 'Pending' },
          { value: 'CLEARED', label: 'Cleared' },
          { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
        ],
      },
    ];

    for (const config of configs) {
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

      const [configRow] = await queryRunner.query(
        `SELECT id FROM configurations WHERE key = $1 AND module = $2`,
        [config.key, config.module],
      );

      if (configRow) {
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
    const configKeys = [
      'fnf_settings',
      'fnf_exit_reasons',
      'fnf_statuses',
      'fnf_clearance_statuses',
    ];

    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'fnf'
       )`,
      [configKeys],
    );

    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = 'fnf'`, [
      configKeys,
    ]);
  }
}
