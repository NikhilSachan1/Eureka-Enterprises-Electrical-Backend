import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSalaryPayrollConfigurations1770000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== SALARY CONFIGURATIONS ====================
    const salaryConfigs = [
      {
        module: 'salary',
        key: 'salary_increment_types',
        label: 'Salary Increment Types',
        valueType: 'array',
        description: 'Types of salary increments that can be applied',
        values: [
          { value: 'INITIAL', label: 'Initial (First Salary)' },
          { value: 'ANNUAL', label: 'Annual Increment' },
          { value: 'PROMOTION', label: 'Promotion' },
          { value: 'CORRECTION', label: 'Correction/Adjustment' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'salary',
        key: 'salary_components',
        label: 'Salary Components',
        valueType: 'json',
        description: 'Configurable salary components with their settings',
        values: {
          earnings: [
            { key: 'basic', label: 'Basic Salary', mandatory: true, taxable: true },
            { key: 'hra', label: 'House Rent Allowance', mandatory: false, taxable: true },
            { key: 'foodAllowance', label: 'Food Allowance', mandatory: false, taxable: true },
            {
              key: 'conveyanceAllowance',
              label: 'Conveyance Allowance',
              mandatory: false,
              taxable: false,
              maxExempt: 1600,
            },
            {
              key: 'medicalAllowance',
              label: 'Medical Allowance',
              mandatory: false,
              taxable: false,
              maxExempt: 15000,
            },
            {
              key: 'specialAllowance',
              label: 'Special Allowance',
              mandatory: false,
              taxable: true,
            },
          ],
          deductions: [
            {
              key: 'employeePf',
              label: 'Employee PF',
              mandatory: false,
              percentage: 12,
              ofComponent: 'basic',
            },
            {
              key: 'employerPf',
              label: 'Employer PF',
              mandatory: false,
              percentage: 12,
              ofComponent: 'basic',
            },
            { key: 'tds', label: 'TDS', mandatory: false, manual: true },
            { key: 'esic', label: 'ESIC', mandatory: false, percentage: 0.75, grossLimit: 21000 },
            { key: 'professionalTax', label: 'Professional Tax', mandatory: false, manual: true },
          ],
        },
      },
      {
        module: 'salary',
        key: 'esic_gross_limit',
        label: 'ESIC Gross Salary Limit',
        valueType: 'number',
        description: 'Maximum gross salary for ESIC applicability (in INR)',
        values: 21000,
      },
      {
        module: 'salary',
        key: 'pf_percentage',
        label: 'PF Percentage',
        valueType: 'json',
        description: 'PF contribution percentages',
        values: {
          employee: 12,
          employer: 12,
          maxBasicForPf: 15000, // PF calculated on max 15000 basic
        },
      },
      {
        module: 'salary',
        key: 'professional_tax_slabs',
        label: 'Professional Tax Slabs',
        valueType: 'json',
        description: 'State-wise professional tax slabs',
        values: {
          default: [
            { minSalary: 0, maxSalary: 10000, tax: 0 },
            { minSalary: 10001, maxSalary: 15000, tax: 150 },
            { minSalary: 15001, maxSalary: null, tax: 200 },
          ],
        },
      },
    ];

    // ==================== BONUS CONFIGURATIONS ====================
    const bonusConfigs = [
      {
        module: 'bonus',
        key: 'bonus_types',
        label: 'Bonus Types',
        valueType: 'array',
        description: 'Types of bonuses that can be given to employees',
        values: [
          { value: 'DIWALI', label: 'Diwali Bonus' },
          { value: 'BIRTHDAY', label: 'Birthday Bonus' },
          { value: 'PERFORMANCE', label: 'Performance Bonus' },
          { value: 'JOINING', label: 'Joining Bonus' },
          { value: 'REFERRAL', label: 'Referral Bonus' },
          { value: 'ANNUAL', label: 'Annual Bonus' },
          { value: 'FESTIVAL', label: 'Festival Bonus' },
          { value: 'SPOT', label: 'Spot Award' },
          { value: 'RETENTION', label: 'Retention Bonus' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'bonus',
        key: 'bonus_statuses',
        label: 'Bonus Statuses',
        valueType: 'array',
        description: 'Status flow for bonuses',
        values: [
          { value: 'PENDING', label: 'Pending', description: 'Bonus created, awaiting payroll' },
          { value: 'PAID', label: 'Paid', description: 'Included in payroll and paid' },
          { value: 'CANCELLED', label: 'Cancelled', description: 'Bonus cancelled' },
        ],
      },
    ];

    // ==================== PAYROLL CONFIGURATIONS ====================
    const payrollConfigs = [
      {
        module: 'payroll',
        key: 'payroll_statuses',
        label: 'Payroll Statuses',
        valueType: 'array',
        description: 'Status flow for payroll processing',
        values: [
          { value: 'DRAFT', label: 'Draft', description: 'Initial state' },
          { value: 'GENERATED', label: 'Generated', description: 'Payroll calculated' },
          { value: 'APPROVED', label: 'Approved', description: 'Approved by admin' },
          { value: 'PAID', label: 'Paid', description: 'Payment completed' },
          { value: 'CANCELLED', label: 'Cancelled', description: 'Payroll cancelled' },
        ],
      },
      {
        module: 'payroll',
        key: 'payroll_generation_day',
        label: 'Payroll Generation Day',
        valueType: 'number',
        description: 'Day of month for auto payroll generation (1-28)',
        values: 2,
      },
      {
        module: 'payroll',
        key: 'payroll_working_days_calculation',
        label: 'Working Days Calculation',
        valueType: 'json',
        description: 'Settings for calculating working days in a month',
        values: {
          excludeSundays: true,
          excludeSaturdays: false, // Some orgs have alternate Saturdays
          useHolidayCalendar: true, // Use holiday_calendar config
          defaultWorkingDays: 26, // Default if calculation not possible
        },
      },
    ];

    // Combine all configs
    const allConfigs = [...salaryConfigs, ...bonusConfigs, ...payrollConfigs];

    // Insert configurations and their settings
    for (const config of allConfigs) {
      // Insert configuration
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (key) DO NOTHING`,
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
    const salaryKeys = [
      'salary_increment_types',
      'salary_components',
      'esic_gross_limit',
      'pf_percentage',
      'professional_tax_slabs',
    ];

    const bonusKeys = ['bonus_types', 'bonus_statuses'];

    const payrollKeys = [
      'payroll_statuses',
      'payroll_generation_day',
      'payroll_working_days_calculation',
    ];

    const allKeys = [...salaryKeys, ...bonusKeys, ...payrollKeys];
    const modules = ['salary', 'bonus', 'payroll'];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = ANY($2)
       )`,
      [allKeys, modules],
    );

    // Delete configurations
    await queryRunner.query(`DELETE FROM configurations WHERE key = ANY($1) AND module = ANY($2)`, [
      allKeys,
      modules,
    ]);
  }
}
