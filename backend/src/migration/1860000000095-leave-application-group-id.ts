import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Groups the day rows of one leave application.
 *
 * Applying (or forcing) leave for a range stores one row per day. Approval stays per day, but
 * the list should show the application as one row. New submissions get one
 * "applicationGroupId" for all their days (set in the service).
 *
 * Existing rows are back-filled once: rows of the same employee, leave type, category,
 * application type and creator whose createdAt is within 60 seconds of the previous one were
 * created by the same submission (the service inserts them together), so they share a group.
 * Approval status is not part of the rule — days of one application can be decided differently.
 * Only rows without a group are touched, so running this again changes nothing.
 *
 * `down` drops the column and its index.
 */
export class LeaveApplicationGroupId1860000000095 implements MigrationInterface {
  name = 'LeaveApplicationGroupId1860000000095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE leave_applications ADD COLUMN IF NOT EXISTS "applicationGroupId" uuid NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LEAVE_APPLICATIONS_APPLICATION_GROUP_ID"
         ON leave_applications ("applicationGroupId")`,
    );

    await queryRunner.query(`
      WITH ordered AS (
        SELECT la.id, la."userId", la."leaveType", la."leaveCategory", la."leaveApplicationType",
               COALESCE(la."createdBy"::text, '') AS creator, la."createdAt", la."fromDate",
               LAG(la."createdAt") OVER w AS "previousAt"
          FROM leave_applications la
         WHERE la."applicationGroupId" IS NULL
        WINDOW w AS (
          PARTITION BY la."userId", la."leaveType", la."leaveCategory", la."leaveApplicationType",
                       COALESCE(la."createdBy"::text, '')
          ORDER BY la."createdAt", la."fromDate", la.id
        )
      ),
      numbered AS (
        SELECT o.*,
               SUM(CASE WHEN o."previousAt" IS NULL
                          OR o."createdAt" - o."previousAt" > INTERVAL '60 seconds'
                        THEN 1 ELSE 0 END)
                 OVER (PARTITION BY o."userId", o."leaveType", o."leaveCategory",
                                    o."leaveApplicationType", o.creator
                       ORDER BY o."createdAt", o."fromDate", o.id
                       ROWS UNBOUNDED PRECEDING) AS grp
          FROM ordered o
      ),
      groups AS (
        SELECT g.*, uuid_generate_v4() AS "groupId"
          FROM (SELECT DISTINCT "userId", "leaveType", "leaveCategory", "leaveApplicationType",
                                creator, grp
                  FROM numbered) g
      )
      UPDATE leave_applications la
         SET "applicationGroupId" = groups."groupId"
        FROM numbered n
        JOIN groups
          ON groups."userId" = n."userId"
         AND groups."leaveType" = n."leaveType"
         AND groups."leaveCategory" = n."leaveCategory"
         AND groups."leaveApplicationType" = n."leaveApplicationType"
         AND groups.creator = n.creator
         AND groups.grp = n.grp
       WHERE la.id = n.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LEAVE_APPLICATIONS_APPLICATION_GROUP_ID"`);
    await queryRunner.query(
      `ALTER TABLE leave_applications DROP COLUMN IF EXISTS "applicationGroupId"`,
    );
  }
}
