import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmployeeDetailsToUsers1760000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add all employee detail columns to users table
    await queryRunner.addColumns('users', [
      // Personal Information
      new TableColumn({
        name: 'fatherName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'emergencyContactNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'gender',
        type: 'varchar',
        length: '20',
        isNullable: true,
        comment: 'MALE, FEMALE, OTHER',
      }),
      new TableColumn({
        name: 'dateOfBirth',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bloodGroup',
        type: 'varchar',
        length: '10',
        isNullable: true,
        comment: 'A+, A-, B+, B-, AB+, AB-, O+, O-',
      }),

      // Address Information
      new TableColumn({
        name: 'houseNumber',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'streetName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'landmark',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'city',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'state',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'pincode',
        type: 'varchar',
        length: '10',
        isNullable: true,
      }),

      // Employment Details
      new TableColumn({
        name: 'dateOfJoining',
        type: 'date',
        isNullable: true,
      }),
      new TableColumn({
        name: 'previousExperience',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Experience in years/months format',
      }),
      new TableColumn({
        name: 'employeeType',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'CONTRACT, PERMANENT, INTERN, PROBATION',
      }),
      new TableColumn({
        name: 'designation',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Job title/designation',
      }),

      // Education Details
      new TableColumn({
        name: 'degree',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Highest degree obtained',
      }),
      new TableColumn({
        name: 'branch',
        type: 'varchar',
        length: '100',
        isNullable: true,
        comment: 'Branch/specialization',
      }),
      new TableColumn({
        name: 'passoutYear',
        type: 'int',
        isNullable: true,
      }),

      // Banking Details
      new TableColumn({
        name: 'bankHolderName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'accountNumber',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bankName',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ifscCode',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),

      // Government IDs and Documents
      new TableColumn({
        name: 'esicNumber',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({
        name: 'esicDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'S3 file path for ESIC document',
      }),
      new TableColumn({
        name: 'aadharNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'aadharDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'S3 file path for Aadhar document',
      }),
      new TableColumn({
        name: 'panNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'panDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'S3 file path for PAN document',
      }),
      new TableColumn({
        name: 'dlNumber',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Driving License Number',
      }),
      new TableColumn({
        name: 'dlDoc',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'S3 file path for DL document',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all added columns in reverse order
    const columnsToRemove = [
      'dlDoc',
      'dlNumber',
      'panDoc',
      'panNumber',
      'aadharDoc',
      'aadharNumber',
      'esicDoc',
      'esicNumber',
      'ifscCode',
      'bankName',
      'accountNumber',
      'bankHolderName',
      'passoutYear',
      'branch',
      'degree',
      'designation',
      'employeeType',
      'previousExperience',
      'dateOfJoining',
      'pincode',
      'state',
      'city',
      'landmark',
      'streetName',
      'houseNumber',
      'bloodGroup',
      'dateOfBirth',
      'gender',
      'emergencyContactNumber',
      'fatherName',
    ];

    for (const columnName of columnsToRemove) {
      await queryRunner.dropColumn('users', columnName);
    }
  }
}
