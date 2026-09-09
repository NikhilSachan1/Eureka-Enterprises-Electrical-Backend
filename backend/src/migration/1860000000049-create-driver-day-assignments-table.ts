import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the driver ↔ engineer pairing table.
 *
 * The pairing decides who receives a driver's daily food allowance. Until now it lived only inside
 * `attendances.assignmentSnapshot`, typed by the driver at check-in, which is why the wrong
 * engineer was frequently paid. The engineer now states it during his own check-in and the server
 * derives `assignedEngineer` from here.
 *
 * The unique index is partial on `deletedAt IS NULL` deliberately: releasing a pairing soft-deletes
 * the row, and the driver must then be claimable again by someone else on that same day.
 */
export class CreateDriverDayAssignmentsTable1860000000049 implements MigrationInterface {
  name = 'CreateDriverDayAssignmentsTable1860000000049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_day_assignments" (
        "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driverId"   uuid NOT NULL,
        "engineerId" uuid NOT NULL,
        "workDate"   date NOT NULL,
        "createdBy"  uuid NULL,
        "updatedBy"  uuid NULL,
        "deletedBy"  uuid NULL,
        "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
        "deletedAt"  TIMESTAMP NULL,
        CONSTRAINT "PK_driver_day_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_driver_day_assignments_driver"
          FOREIGN KEY ("driverId") REFERENCES "users"("id"),
        CONSTRAINT "FK_driver_day_assignments_engineer"
          FOREIGN KEY ("engineerId") REFERENCES "users"("id")
      )
    `);

    // A driver cannot be claimed twice on the same day. Enforced here rather than in application
    // code so two concurrent check-ins cannot both succeed.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_DRIVER_DAY_ASSIGNMENT_ACTIVE"
        ON "driver_day_assignments" ("driverId", "workDate")
        WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_DRIVER_DAY_ASSIGNMENT_DRIVER" ON "driver_day_assignments" ("driverId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_DRIVER_DAY_ASSIGNMENT_ENGINEER" ON "driver_day_assignments" ("engineerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_DRIVER_DAY_ASSIGNMENT_DATE" ON "driver_day_assignments" ("workDate")`,
    );

    await queryRunner.query(`
      COMMENT ON TABLE "driver_day_assignments" IS
        'Driver to engineer pairing for a single day. Source of truth for attendances.assignmentSnapshot.assignedEngineer, which decides who receives the driver food allowance.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "driver_day_assignments"`);
  }
}
