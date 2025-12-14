import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedEmployeeConfigurations1760000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Define employee configurations
    const employeeConfigs = [
      {
        module: 'employee',
        key: 'genders',
        label: 'Genders',
        valueType: 'array',
        description: 'Available gender options for employee registration',
        values: [
          { value: 'MALE', label: 'Male' },
          { value: 'FEMALE', label: 'Female' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'employee',
        key: 'blood_groups',
        label: 'Blood Groups',
        valueType: 'array',
        description: 'Available blood group options for employee registration',
        values: [
          { value: 'A+', label: 'A Positive (A+)' },
          { value: 'A-', label: 'A Negative (A-)' },
          { value: 'B+', label: 'B Positive (B+)' },
          { value: 'B-', label: 'B Negative (B-)' },
          { value: 'AB+', label: 'AB Positive (AB+)' },
          { value: 'AB-', label: 'AB Negative (AB-)' },
          { value: 'O+', label: 'O Positive (O+)' },
          { value: 'O-', label: 'O Negative (O-)' },
        ],
      },
      {
        module: 'employee',
        key: 'employee_types',
        label: 'Employee Types',
        valueType: 'array',
        description: 'Available employee type options (contract, permanent, etc.)',
        values: [
          { value: 'CONTRACT', label: 'Contract' },
          { value: 'PERMANENT', label: 'Permanent' },
          { value: 'INTERN', label: 'Intern' },
          { value: 'PROBATION', label: 'Probation' },
        ],
      },
      {
        module: 'employee',
        key: 'designations',
        label: 'Designations',
        valueType: 'array',
        description: 'Available job designation options for employees',
        values: [
          { value: 'TESTER', label: 'Tester' },
          { value: 'MANAGER', label: 'Manager' },
          { value: 'DEVELOPER', label: 'Developer' },
          { value: 'SENIOR_DEVELOPER', label: 'Senior Developer' },
          { value: 'TEAM_LEAD', label: 'Team Lead' },
          { value: 'PROJECT_MANAGER', label: 'Project Manager' },
          { value: 'HR', label: 'Human Resources' },
          { value: 'ADMIN', label: 'Admin' },
          { value: 'ACCOUNTANT', label: 'Accountant' },
          { value: 'DESIGNER', label: 'Designer' },
          { value: 'DEVOPS', label: 'DevOps' },
          { value: 'QA_ENGINEER', label: 'QA Engineer' },
          { value: 'BUSINESS_ANALYST', label: 'Business Analyst' },
          { value: 'DATA_ANALYST', label: 'Data Analyst' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'employee',
        key: 'degrees',
        label: 'Degrees',
        valueType: 'array',
        description: 'Available educational degree options',
        values: [
          { value: 'HIGH_SCHOOL', label: 'High School' },
          { value: 'DIPLOMA', label: 'Diploma' },
          { value: 'BACHELORS', label: 'Bachelors' },
          { value: 'MASTERS', label: 'Masters' },
          { value: 'PHD', label: 'PhD' },
          { value: 'B.TECH', label: 'B.Tech' },
          { value: 'M.TECH', label: 'M.Tech' },
          { value: 'BCA', label: 'BCA' },
          { value: 'MCA', label: 'MCA' },
          { value: 'B.SC', label: 'B.Sc' },
          { value: 'M.SC', label: 'M.Sc' },
          { value: 'BBA', label: 'BBA' },
          { value: 'MBA', label: 'MBA' },
          { value: 'B.COM', label: 'B.Com' },
          { value: 'M.COM', label: 'M.Com' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'employee',
        key: 'branches',
        label: 'Branches/Specializations',
        valueType: 'array',
        description: 'Available educational branch/specialization options',
        values: [
          { value: 'COMPUTER_SCIENCE', label: 'Computer Science' },
          { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
          { value: 'ELECTRONICS', label: 'Electronics' },
          { value: 'ELECTRICAL', label: 'Electrical' },
          { value: 'MECHANICAL', label: 'Mechanical' },
          { value: 'CIVIL', label: 'Civil' },
          { value: 'CHEMICAL', label: 'Chemical' },
          { value: 'BIOTECHNOLOGY', label: 'Biotechnology' },
          { value: 'COMMERCE', label: 'Commerce' },
          { value: 'ARTS', label: 'Arts' },
          { value: 'SCIENCE', label: 'Science' },
          { value: 'FINANCE', label: 'Finance' },
          { value: 'MARKETING', label: 'Marketing' },
          { value: 'HUMAN_RESOURCES', label: 'Human Resources' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      {
        module: 'employee',
        key: 'document_types',
        label: 'Document Types',
        valueType: 'array',
        description: 'Available document types for employee identity verification',
        values: [
          { value: 'AADHAR', label: 'Aadhar Card' },
          { value: 'PAN', label: 'PAN Card' },
          { value: 'DRIVING_LICENSE', label: 'Driving License' },
          { value: 'ESIC', label: 'ESIC Document' },
          { value: 'PASSPORT', label: 'Passport' },
          { value: 'VOTER_ID', label: 'Voter ID' },
          { value: 'OFFER_LETTER', label: 'Offer Letter' },
          { value: 'EXPERIENCE_LETTER', label: 'Experience Letter' },
          { value: 'EDUCATION_CERTIFICATE', label: 'Education Certificate' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
    ];

    // Insert configurations and their settings
    for (const config of employeeConfigs) {
      // Insert configuration
      await queryRunner.query(
        `INSERT INTO configurations (module, key, label, "valueType", description, "isEditable", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (module, key) DO NOTHING`,
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
    const employeeKeys = [
      'genders',
      'blood_groups',
      'employee_types',
      'designations',
      'degrees',
      'branches',
      'document_types',
    ];

    // Delete config_settings first (due to foreign key)
    await queryRunner.query(
      `DELETE FROM config_settings 
       WHERE "configId" IN (
         SELECT id FROM configurations WHERE key = ANY($1) AND module = 'employee'
       )`,
      [employeeKeys],
    );

    // Delete configurations
    await queryRunner.query(
      `DELETE FROM configurations WHERE key = ANY($1) AND module = 'employee'`,
      [employeeKeys],
    );
  }
}
