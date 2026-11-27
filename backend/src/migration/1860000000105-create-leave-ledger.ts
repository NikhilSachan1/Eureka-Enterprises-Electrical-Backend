import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Leave ledger: every credit, debit and adjustment of a leave balance becomes one row.
 *
 * leave_balances stays as the per-employee summary (totalAllocated / consumed) that payroll,
 * payslip, FnF and dashboards read; from now on it is only written together with a ledger row.
 *
 * Backfill, per existing leave_balances row:
 *   - holiday_work_credit  one row per "Credited N Earned Leave(s) for working on holidays" note
 *   - legacy_opening       totalAllocated minus those holiday credits (what the old monthly cron
 *                          credited). Its periodMonth is the month the migration runs in: the old
 *                          cron had already credited that month in advance, so the new monthly
 *                          settlement starts with the month after it.
 *   - legacy_consumed      minus consumed (leave already taken, pending or approved)
 * Totals therefore match leave_balances exactly; no employee's balance changes here.
 * Correcting the old over-credit is a separate, reviewed step (recalculation report + apply).
 *
 * Also registers two permissions:
 *   leave.ledger.view-all     see any employee's ledger (granted like leave.force)
 *   leave.credit.recalculate  review and apply the credit recalculation (granted like leave.force)
 * An employee always sees their own ledger.
 */
export class CreateLeaveLedger1860000000105 implements MigrationInterface {
  name = 'CreateLeaveLedger1860000000105';

  private static readonly HOLIDAY_NOTE =
    /Credited (\d+(?:\.\d+)?) Earned Leave\(s\) for working on holidays \(([^)]*)\)/gi;

  private static readonly PERMISSION_MODULE = 'leave';
  private static readonly GRANT_LIKE = 'leave.force';
  private static readonly PERMISSIONS = [
    {
      name: 'leave.ledger.view-all',
      label: 'view all leave ledgers',
      description: "See any employee's leave ledger (credits, debits, adjustments)",
    },
    {
      name: 'leave.credit.recalculate',
      label: 'recalculate leave credit',
      description: 'Review and apply the attendance-based leave credit recalculation',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS leave_ledger_entries (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "leaveCategory" varchar NOT NULL,
        "financialYear" varchar NOT NULL,
        "entryType" varchar NOT NULL,
        "days" numeric(6,2) NOT NULL,
        "periodMonth" date NULL,
        "leaveApplicationId" uuid NULL REFERENCES leave_applications(id) ON DELETE SET NULL,
        "attendanceId" uuid NULL,
        "reason" text NULL,
        "metadata" jsonb NULL,
        "createdBy" uuid NULL,
        "updatedBy" uuid NULL,
        "deletedBy" uuid NULL,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "deletedAt" timestamp NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LEAVE_LEDGER_USER_FY"
         ON leave_ledger_entries ("userId", "leaveCategory", "financialYear", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_LEAVE_LEDGER_APPLICATION"
         ON leave_ledger_entries ("leaveApplicationId") WHERE "leaveApplicationId" IS NOT NULL`,
    );
    // One advance per employee per category per year (April, or the joining month).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_LEAVE_LEDGER_ADVANCE"
         ON leave_ledger_entries ("userId", "leaveCategory", "financialYear")
         WHERE "entryType" = 'advance_credit' AND "deletedAt" IS NULL`,
    );

    await this.backfill(queryRunner);
    await this.seedPermissions(queryRunner);
  }

  private async backfill(queryRunner: QueryRunner): Promise<void> {
    const [{ month }] = await queryRunner.query(
      `SELECT to_char(date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS month`,
    );

    const balances: Array<{
      userId: string;
      leaveCategory: string;
      financialYear: string;
      totalAllocated: string;
      consumed: string;
      notes: string | null;
    }> = await queryRunner.query(
      `SELECT "userId", "leaveCategory", "financialYear", "totalAllocated", consumed, notes
         FROM leave_balances
        WHERE "deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM leave_ledger_entries e
             WHERE e."userId" = leave_balances."userId"
               AND e."leaveCategory" = leave_balances."leaveCategory"
               AND e."financialYear" = leave_balances."financialYear"
          )`,
    );

    for (const balance of balances) {
      const allocated = Number(balance.totalAllocated) || 0;
      const consumed = Number(balance.consumed) || 0;
      const key = [balance.userId, balance.leaveCategory, balance.financialYear];

      let holidayTotal = 0;
      for (const match of (balance.notes ?? '').matchAll(
        CreateLeaveLedger1860000000105.HOLIDAY_NOTE,
      )) {
        const days = Number(match[1]) || 0;
        if (days <= 0) continue;
        holidayTotal += days;
        await queryRunner.query(
          `INSERT INTO leave_ledger_entries
             ("userId", "leaveCategory", "financialYear", "entryType", days, reason)
           VALUES ($1, $2, $3, 'holiday_work_credit', $4, $5)`,
          [...key, days, `Worked on holiday (${match[2]})`],
        );
      }

      await queryRunner.query(
        `INSERT INTO leave_ledger_entries
           ("userId", "leaveCategory", "financialYear", "entryType", days, "periodMonth", reason, metadata)
         VALUES ($1, $2, $3, 'legacy_opening', $4, $5::date, $6, $7)`,
        [
          ...key,
          allocated - holidayTotal,
          month,
          'Opening balance from the old monthly credit (before the ledger)',
          JSON.stringify({ coveredThrough: month.slice(0, 7), legacyNotes: balance.notes }),
        ],
      );

      if (consumed > 0) {
        await queryRunner.query(
          `INSERT INTO leave_ledger_entries
             ("userId", "leaveCategory", "financialYear", "entryType", days, reason)
           VALUES ($1, $2, $3, 'legacy_consumed', $4, $5)`,
          [...key, -consumed, 'Leave taken before the ledger (pending or approved)'],
        );
      }
    }
  }

  private async seedPermissions(queryRunner: QueryRunner): Promise<void> {
    const { PERMISSION_MODULE, GRANT_LIKE, PERMISSIONS } = CreateLeaveLedger1860000000105;

    for (const permission of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
         SELECT $1, $2, $3, $4, true, true, 'web'
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
        [permission.name, PERMISSION_MODULE, permission.label, permission.description],
      );
    }

    await queryRunner.query(
      `INSERT INTO role_permissions ("roleId", "permissionId")
       SELECT existing."roleId", p.id
         FROM role_permissions existing
         JOIN permissions source ON source.id = existing."permissionId"
                                AND source.name = $1
                                AND source."deletedAt" IS NULL
        CROSS JOIN permissions p
        WHERE existing."deletedAt" IS NULL
          AND existing."isActive" = true
          AND p.name = ANY($2)
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [GRANT_LIKE, PERMISSIONS.map((p) => p.name)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = CreateLeaveLedger1860000000105.PERMISSIONS.map((p) => p.name);
    await queryRunner.query(
      `DELETE FROM role_permissions
        WHERE "permissionId" IN (SELECT id FROM permissions WHERE name = ANY($1))`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
    await queryRunner.query(`DROP TABLE IF EXISTS leave_ledger_entries`);
  }
}
