import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddHolidayWorkCompensation1789000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'payroll',
      new TableColumn({
        name: 'holidayLeavesCredited',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    const existingConfig = await queryRunner.query(`
      SELECT id FROM configurations WHERE key = 'holiday_work_compensation'
    `);

    if (existingConfig.length === 0) {
      await queryRunner.query(`
        INSERT INTO configurations (module, key, label, "valueType", "isEditable", description, "createdAt", "updatedAt")
        VALUES (
          'payroll',
          'holiday_work_compensation',
          'Holiday Work Compensation',
          'object',
          true,
          'Configures how employees are compensated for working on holidays. Options: MONEY (holiday bonus) or LEAVE (earned leave credit)',
          NOW(),
          NOW()
        )
      `);

      const configResult = await queryRunner.query(`
        SELECT id FROM configurations WHERE key = 'holiday_work_compensation'
      `);

      if (configResult.length > 0) {
        const configId = configResult[0].id;

        await queryRunner.query(
          `
          INSERT INTO config_settings ("configId", value, "isActive", "createdAt", "updatedAt")
          VALUES (
            $1,
            '{"type": "LEAVE", "leaveCategory": "earned", "leavePerHoliday": 1}'::jsonb,
            true,
            NOW(),
            NOW()
          )
        `,
          [configId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('payroll', 'holidayLeavesCredited');

    const configResult = await queryRunner.query(`
      SELECT id FROM configurations WHERE key = 'holiday_work_compensation'
    `);

    if (configResult.length > 0) {
      const configId = configResult[0].id;

      await queryRunner.query(
        `
        DELETE FROM config_settings WHERE "configId" = $1
      `,
        [configId],
      );

      await queryRunner.query(
        `
        DELETE FROM configurations WHERE id = $1
      `,
        [configId],
      );
    }
  }
}
