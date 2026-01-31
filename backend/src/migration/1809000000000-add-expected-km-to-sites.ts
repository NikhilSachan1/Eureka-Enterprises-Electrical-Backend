import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExpectedKmToSites1809000000000 implements MigrationInterface {
  name = 'AddExpectedKmToSites1809000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column already exists
    const table = await queryRunner.getTable('sites');
    const columnExists = table?.columns.find((c) => c.name === 'expectedVehicleDailyKm');

    if (!columnExists) {
      // Add expectedVehicleDailyKm column to sites table
      await queryRunner.addColumn(
        'sites',
        new TableColumn({
          name: 'expectedVehicleDailyKm',
          type: 'integer',
          isNullable: true,
        }),
      );

      // Update existing sites to have expectedVehicleDailyKm = baseDistanceKm * 2 (round trip)
      await queryRunner.query(`
        UPDATE "sites" 
        SET "expectedVehicleDailyKm" = CAST("baseDistanceKm" * 2 AS integer)
        WHERE "baseDistanceKm" IS NOT NULL AND "expectedVehicleDailyKm" IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sites');
    const columnExists = table?.columns.find((c) => c.name === 'expectedVehicleDailyKm');

    if (columnExists) {
      await queryRunner.dropColumn('sites', 'expectedVehicleDailyKm');
    }
  }
}
