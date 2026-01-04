import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateFnfSettlementsTable1793000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fnf_settlements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'exitDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'exitReason',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'lastWorkingDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'daysWorked',
            type: 'int',
            default: 0,
          },
          {
            name: 'dailySalary',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'finalSalary',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'encashableLeaves',
            type: 'decimal',
            precision: 5,
            scale: 1,
            default: 0,
          },
          {
            name: 'leaveEncashmentAmount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          // Gratuity
          {
            name: 'serviceYears',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'gratuityAmount',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          // Deductions
          {
            name: 'noticePeriodDays',
            type: 'int',
            default: 0,
          },
          {
            name: 'noticePeriodRecovery',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'otherDeductions',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'deductionRemarks',
            type: 'text',
            isNullable: true,
          },
          // Additions
          {
            name: 'pendingReimbursements',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'otherAdditions',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'additionRemarks',
            type: 'text',
            isNullable: true,
          },
          // Clearance Status
          {
            name: 'assetsClearanceStatus',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          {
            name: 'vehiclesClearanceStatus',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          {
            name: 'cardsClearanceStatus',
            type: 'varchar',
            length: '20',
            default: "'PENDING'",
          },
          {
            name: 'clearanceRemarks',
            type: 'text',
            isNullable: true,
          },
          // Totals
          {
            name: 'totalEarnings',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalDeductions',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          {
            name: 'netPayable',
            type: 'decimal',
            precision: 12,
            scale: 2,
            default: 0,
          },
          // Documents
          {
            name: 'relievingLetterKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'experienceLetterKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'fnfStatementKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          // Workflow
          {
            name: 'status',
            type: 'varchar',
            length: '30',
            default: "'INITIATED'",
          },
          {
            name: 'calculatedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'calculatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'remarks',
            type: 'text',
            isNullable: true,
          },
          // Audit columns
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'NOW()',
          },
          {
            name: 'updatedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'fnf_settlements',
      new TableIndex({
        name: 'IDX_FNF_USER_ID',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'fnf_settlements',
      new TableIndex({
        name: 'IDX_FNF_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'fnf_settlements',
      new TableIndex({
        name: 'IDX_FNF_EXIT_DATE',
        columnNames: ['exitDate'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'fnf_settlements',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fnf_settlements');
    if (table) {
      const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('userId') !== -1);
      if (foreignKey) {
        await queryRunner.dropForeignKey('fnf_settlements', foreignKey);
      }
    }
    await queryRunner.dropTable('fnf_settlements');
  }
}
