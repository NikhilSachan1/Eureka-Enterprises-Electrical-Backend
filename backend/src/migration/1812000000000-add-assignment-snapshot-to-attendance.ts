import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssignmentSnapshotToAttendance1812000000000 implements MigrationInterface {
  name = 'AddAssignmentSnapshotToAttendance1812000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances" 
      ADD COLUMN "assignmentSnapshot" jsonb NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "attendances"."assignmentSnapshot" IS 'Stores site, vehicle, and contractors assigned at the time of attendance'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendances" 
      DROP COLUMN "assignmentSnapshot"
    `);
  }
}
