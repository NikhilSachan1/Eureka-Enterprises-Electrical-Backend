import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowNullableFieldsForCreditFuelExpense1796000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Allow NULL for vehicleId - credit entries don't have a vehicle
    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "vehicleId" DROP NOT NULL
    `);

    // Allow NULL for odometerKm - credit entries don't have odometer readings
    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "odometerKm" DROP NOT NULL
    `);

    // Allow NULL for fuelLiters - credit entries don't have fuel quantity
    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "fuelLiters" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: Reverting requires all existing NULL values to be updated first
    // This will fail if there are any credit entries with NULL values

    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "vehicleId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "odometerKm" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "fuel_expenses" ALTER COLUMN "fuelLiters" SET NOT NULL
    `);
  }
}
