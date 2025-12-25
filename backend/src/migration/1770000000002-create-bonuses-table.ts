import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateBonusesTable1770000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(`
      CREATE TYPE "bonus_type_enum" AS ENUM ('DIWALI', 'BIRTHDAY', 'PERFORMANCE', 'JOINING', 'REFERRAL', 'ANNUAL', 'FESTIVAL', 'OTHER')
    `);

    await queryRunner.query(`
      CREATE TYPE "bonus_status_enum" AS ENUM ('PENDING', 'PAID', 'CANCELLED')
    `);

    await queryRunner.createTable(
      new Table({
        name: 'bonuses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid' },
          { name: 'bonusType', type: 'bonus_type_enum' },
          { name: 'amount', type: 'decimal', precision: 12, scale: 2 },
          { name: 'applicableMonth', type: 'int' },
          { name: 'applicableYear', type: 'int' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'status', type: 'bonus_status_enum', default: "'PENDING'" },
          { name: 'isActive', type: 'boolean', default: true },
          // Audit
          { name: 'createdBy', type: 'uuid', isNullable: true },
          { name: 'updatedBy', type: 'uuid', isNullable: true },
          { name: 'deletedBy', type: 'uuid', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'deletedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'bonuses',
      new TableIndex({
        name: 'IDX_BONUS_USER_ID',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'bonuses',
      new TableIndex({
        name: 'IDX_BONUS_APPLICABLE_MONTH_YEAR',
        columnNames: ['applicableMonth', 'applicableYear'],
      }),
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'bonuses',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('bonuses');
    await queryRunner.query(`DROP TYPE "bonus_type_enum"`);
    await queryRunner.query(`DROP TYPE "bonus_status_enum"`);
  }
}
