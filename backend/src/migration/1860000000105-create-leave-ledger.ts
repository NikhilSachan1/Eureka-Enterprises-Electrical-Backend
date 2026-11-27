import { MigrationInterface, QueryRunner } from 'typeorm';

interface BalanceRow {
  id: string;
  userId: string;
  leaveCategory: string;
  notes: string | null;
  dateOfJoining: string | null;
}

interface CountRow {
  userId: string;
  month: string;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
}

interface ApplicationRow {
  id: string;
  userId: string;
  leaveCategory: string;
  fromDate: string;
  toDate: string;
  createdAt: string;
}

interface WorkingDaysSettings {
  excludeSundays: boolean;
  excludeSaturdays: boolean;
  useHolidayCalendar: boolean;
  defaultWorkingDays: number;
}

/**
 * Leave ledger: every credit and debit of a leave balance is one row, and leave_balances
 * (totalAllocated / consumed, read by payroll, payslip, FnF and dashboards) is derived from it.
 *
 * The current financial year's ledger is built from what actually happened, so it reads as if
 * the ledger had always been there:
 *   - monthly_accrual   one row per month from April (or the joining month): what the month
 *                       earned from attendance, credited on the 1st of that month
 *                       (annual quota / 12 × paid days / working days; paid days = present +
 *                       half day × 0.5 + paid leave). Rounded down on the running total, so the
 *                       year adds up exactly. The current month counts the attendance so far;
 *                       the 1st-of-month settlement adds the rest when it ends.
 *   - leave_debit       one row per day of every pending or approved leave application, on the
 *                       leave day (or the day it was applied, if earlier)
 *   - holiday_work_credit  each "worked on holiday" credit, on the holiday
 * leave_balances is then re-derived from these rows, which corrects every balance to what
 * attendance earned.
 *
 * Registers leave.ledger.view-all (see any employee's ledger), granted like leave.force.
 * Every employee can always see their own ledger.
 */
export class CreateLeaveLedger1860000000105 implements MigrationInterface {
  name = 'CreateLeaveLedger1860000000105';

  private static readonly HOLIDAY_NOTE =
    /Credited (\d+(?:\.\d+)?) Earned Leave\(s\) for working on holidays \(([^)]*)\)/gi;
  private static readonly MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  private static readonly PERMISSION_MODULE = 'leave';
  private static readonly GRANT_LIKE = 'leave.force';
  private static readonly PERMISSION = {
    name: 'leave.ledger.view-all',
    label: 'view all leave ledgers',
    description: "See any employee's leave ledger (credits, debits, adjustments)",
  };

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

    await this.buildCurrentYear(queryRunner);
    await this.seedPermission(queryRunner);
  }

  private async buildCurrentYear(queryRunner: QueryRunner): Promise<void> {
    const [{ today }] = await queryRunner.query(
      `SELECT to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS today`,
    );
    const currentMonth = today.slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const fyStartYear = month >= 4 ? year : year - 1;
    const financialYear = `${fyStartYear}-${fyStartYear + 1}`;
    const fyStart = `${fyStartYear}-04`;

    const categoriesConfig =
      (await this.getConfig(queryRunner, 'leave', 'leave_categories_config', financialYear)) ?? {};
    const quotas = new Map<string, number>();
    for (const [category, value] of Object.entries(categoriesConfig as Record<string, any>)) {
      const config = value?.actual ?? value?.default;
      if (config && (config.creditFrequency ?? 'monthly') === 'monthly') {
        quotas.set(category, Number(config.annualQuota) || 0);
      }
    }
    const calendar = await this.getConfig(queryRunner, 'leave', 'calendar_settings', financialYear);
    const step = calendar?.allowFractional ? 0.5 : 1;
    const wdValue = await this.getConfig(
      queryRunner,
      'payroll',
      'payroll_working_days_calculation',
    );
    const workingDaysSettings: WorkingDaysSettings = {
      excludeSundays: wdValue?.excludeSundays ?? true,
      excludeSaturdays: wdValue?.excludeSaturdays ?? false,
      useHolidayCalendar: wdValue?.useHolidayCalendar ?? true,
      defaultWorkingDays: Number(wdValue?.defaultWorkingDays) || 26,
    };
    const holidayValue = await this.getConfig(
      queryRunner,
      'leave',
      'holiday_calendar',
      financialYear,
    );
    const holidays = new Set<string>(
      ((holidayValue?.holidays ?? []) as Array<string | { date?: string }>)
        .map((h) => (typeof h === 'string' ? h : h?.date))
        .filter((d): d is string => !!d),
    );

    const balances: BalanceRow[] = await queryRunner.query(
      `SELECT lb.id, lb."userId", lb."leaveCategory", lb.notes,
              to_char(u."dateOfJoining", 'YYYY-MM-DD') AS "dateOfJoining"
         FROM leave_balances lb
         JOIN users u ON u.id = lb."userId"
        WHERE lb."financialYear" = $1 AND lb."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM leave_ledger_entries e
             WHERE e."userId" = lb."userId" AND e."leaveCategory" = lb."leaveCategory"
               AND e."financialYear" = lb."financialYear"
          )`,
      [financialYear],
    );
    if (!balances.length) return;

    // Totals before the rebuild, so `down` can put them back. (CREATE TABLE AS takes no
    // parameters; financialYear is built above from the date, digits and a dash only.)
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS leave_balances_before_ledger AS
         SELECT id, "totalAllocated", consumed FROM leave_balances
          WHERE "financialYear" = '${financialYear}'`,
    );

    const userIds = [...new Set(balances.map((b) => b.userId))];
    const counts: CountRow[] = await queryRunner.query(
      `SELECT a."userId", to_char(a."attendanceDate", 'YYYY-MM') AS month,
              COUNT(*) FILTER (WHERE a.status IN ('present', 'approvalPending'))::int AS "presentDays",
              COUNT(*) FILTER (WHERE a.status = 'halfDay')::int AS "halfDays",
              COUNT(*) FILTER (WHERE a.status = 'leave')::int AS "paidLeaveDays"
         FROM attendances a
        WHERE a."userId" = ANY($1)
          AND a."attendanceDate" >= $2::date AND a."attendanceDate" <= $3::date
          AND a."isActive" = true AND a."deletedAt" IS NULL
          AND a."approvalStatus" <> 'rejected'
        GROUP BY 1, 2`,
      [userIds, `${fyStart}-01`, today],
    );
    const countOf = new Map(counts.map((c) => [`${c.userId}|${c.month}`, c]));

    const applications: ApplicationRow[] = await queryRunner.query(
      `SELECT id, "userId", "leaveCategory",
              to_char("fromDate", 'YYYY-MM-DD') AS "fromDate",
              to_char("toDate", 'YYYY-MM-DD') AS "toDate",
              to_char("createdAt", 'YYYY-MM-DD HH24:MI:SS') AS "createdAt"
         FROM leave_applications
        WHERE "userId" = ANY($1)
          AND "approvalStatus" IN ('pending', 'approved')
          AND "deletedAt" IS NULL
          AND "fromDate" >= $2::date AND "fromDate" < $3::date`,
      [userIds, `${fyStart}-01`, `${fyStartYear + 1}-04-01`],
    );

    for (const balance of balances) {
      const key = [balance.userId, balance.leaveCategory, financialYear];
      const quota = quotas.get(balance.leaveCategory) ?? 0;

      // Monthly credits from attendance, on the 1st of each month.
      const joiningMonth = balance.dateOfJoining?.slice(0, 7);
      const firstMonth = joiningMonth && joiningMonth > fyStart ? joiningMonth : fyStart;
      let earnedTotal = 0;
      let credited = 0;
      for (let m = firstMonth; quota > 0 && m <= currentMonth; m = this.addMonths(m, 1)) {
        const count = countOf.get(`${balance.userId}|${m}`);
        const workingDays = this.workingDays(m, workingDaysSettings, holidays);
        const presentDays = count?.presentDays ?? 0;
        const halfDays = count?.halfDays ?? 0;
        const paidLeaveDays = count?.paidLeaveDays ?? 0;
        const paidDays = Math.min(presentDays + halfDays * 0.5 + paidLeaveDays, workingDays);
        const earned =
          workingDays > 0 ? Math.round((quota / 12) * (paidDays / workingDays) * 10000) / 10000 : 0;
        earnedTotal += earned;
        const target = Math.floor(earnedTotal / step + 1e-9) * step;
        const days = Math.round((target - credited) * 100) / 100;
        credited = target;
        if (days === 0) continue;

        const creditDay =
          joiningMonth === m && balance.dateOfJoining ? balance.dateOfJoining : `${m}-01`;
        await this.insertEntry(queryRunner, {
          key,
          entryType: 'monthly_accrual',
          days,
          periodMonth: `${m}-01`,
          createdAt: `${creditDay} 00:05:00`,
          reason: `Earned from attendance for ${this.monthLabel(m)}`,
          metadata: {
            months: [
              { month: m, workingDays, presentDays, halfDays, paidLeaveDays, paidDays, earned },
            ],
          },
        });
      }

      // Worked-on-holiday credits, on the holiday.
      for (const match of (balance.notes ?? '').matchAll(
        CreateLeaveLedger1860000000105.HOLIDAY_NOTE,
      )) {
        const days = Number(match[1]) || 0;
        if (days <= 0) continue;
        const holidayDate = this.parseHolidayDate(match[2]) ?? today;
        await this.insertEntry(queryRunner, {
          key,
          entryType: 'holiday_work_credit',
          days,
          periodMonth: `${holidayDate.slice(0, 7)}-01`,
          createdAt: `${holidayDate} 18:00:00`,
          reason: `Worked on holiday (${match[2]})`,
        });
      }

      // One debit per leave day, on the leave day (or when applied, if that was earlier).
      for (const application of applications) {
        if (
          application.userId !== balance.userId ||
          application.leaveCategory !== balance.leaveCategory
        ) {
          continue;
        }
        for (const day of this.dayRange(application.fromDate, application.toDate)) {
          const onDay = `${day} 09:00:00`;
          await this.insertEntry(queryRunner, {
            key,
            entryType: 'leave_debit',
            days: -1,
            createdAt: application.createdAt < onDay ? application.createdAt : onDay,
            reason: `Leave on ${day}`,
            leaveApplicationId: application.id,
          });
        }
      }

      await queryRunner.query(
        `UPDATE leave_balances lb
            SET "totalAllocated" = t.allocated::text, consumed = t.consumed::text, "updatedAt" = NOW()
           FROM (
             SELECT COALESCE(SUM(days) FILTER (WHERE "entryType" <> 'leave_debit'), 0) AS allocated,
                    COALESCE(-SUM(days) FILTER (WHERE "entryType" = 'leave_debit'), 0) AS consumed
               FROM leave_ledger_entries
              WHERE "userId" = $1 AND "leaveCategory" = $2 AND "financialYear" = $3
                AND "deletedAt" IS NULL
           ) t
          WHERE lb.id = $4`,
        [...key, balance.id],
      );
    }
  }

  private async insertEntry(
    queryRunner: QueryRunner,
    entry: {
      key: string[];
      entryType: string;
      days: number;
      periodMonth?: string;
      createdAt: string;
      reason: string;
      leaveApplicationId?: string;
      metadata?: unknown;
    },
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO leave_ledger_entries
         ("userId", "leaveCategory", "financialYear", "entryType", days, "periodMonth",
          "leaveApplicationId", reason, metadata, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10::timestamp, $10::timestamp)`,
      [
        ...entry.key,
        entry.entryType,
        entry.days,
        entry.periodMonth ?? null,
        entry.leaveApplicationId ?? null,
        entry.reason,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.createdAt,
      ],
    );
  }

  private async getConfig(
    queryRunner: QueryRunner,
    module: string,
    key: string,
    contextKey?: string,
  ): Promise<any> {
    const [row] = await queryRunner.query(
      `SELECT cs.value
         FROM configurations c
         JOIN config_settings cs ON cs."configId" = c.id AND cs."deletedAt" IS NULL
        WHERE c.module = $1 AND c.key = $2 AND c."deletedAt" IS NULL
          AND ($3::text IS NULL OR cs."contextKey" = $3)
        ORDER BY cs."isActive" DESC, cs."createdAt" DESC
        LIMIT 1`,
      [module, key, contextKey ?? null],
    );
    return row?.value ?? null;
  }

  private workingDays(month: string, settings: WorkingDaysSettings, holidays: Set<string>): number {
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const weekday = new Date(Date.UTC(year, mon - 1, day)).getUTCDay();
      if (settings.excludeSundays && weekday === 0) continue;
      if (settings.excludeSaturdays && weekday === 6) continue;
      if (settings.useHolidayCalendar && holidays.has(`${month}-${String(day).padStart(2, '0')}`))
        continue;
      count++;
    }
    return count || settings.defaultWorkingDays;
  }

  private addMonths(month: string, delta: number): string {
    const [year, mon] = month.split('-').map(Number);
    const index = year * 12 + (mon - 1) + delta;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
  }

  private monthLabel(month: string): string {
    const [year, mon] = month.split('-').map(Number);
    return `${CreateLeaveLedger1860000000105.MONTHS[mon - 1]} ${year}`;
  }

  private dayRange(from: string, to: string): string[] {
    const days: string[] = [];
    const end = Date.parse(`${to}T00:00:00Z`);
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
    return days;
  }

  /** "15 Aug 2026" or "15 Aug 2026, 26 Jan 2027" → the last date as YYYY-MM-DD. */
  private parseHolidayDate(text: string): string | null {
    const last = text.split(',').pop()?.trim() ?? '';
    const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(last);
    if (!match) return null;
    const mon = CreateLeaveLedger1860000000105.MONTHS.indexOf(
      match[2][0].toUpperCase() + match[2].slice(1).toLowerCase(),
    );
    if (mon < 0) return null;
    return `${match[3]}-${String(mon + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  /** Hard-deletes permissions with every grant and per-user override of them. */
  private async deletePermissions(queryRunner: QueryRunner, names: string[]): Promise<void> {
    const ids = `(SELECT id FROM permissions WHERE name = ANY($1))`;
    await queryRunner.query(`DELETE FROM role_permissions WHERE "permissionId" IN ${ids}`, [names]);
    await queryRunner.query(
      `DELETE FROM user_permission_overrides WHERE "permissionId" IN ${ids}`,
      [names],
    );
    await queryRunner.query(`DELETE FROM permissions WHERE name = ANY($1)`, [names]);
  }

  private async seedPermission(queryRunner: QueryRunner): Promise<void> {
    const { PERMISSION_MODULE, GRANT_LIKE, PERMISSION } = CreateLeaveLedger1860000000105;
    await queryRunner.query(
      `INSERT INTO permissions (name, module, label, description, "isEditable", "isDeletable", platform)
       SELECT $1, $2, $3, $4, true, true, 'web'
       WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = $1)`,
      [PERMISSION.name, PERMISSION_MODULE, PERMISSION.label, PERMISSION.description],
    );
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
          AND p.name = $2
          AND p."deletedAt" IS NULL
       ON CONFLICT DO NOTHING`,
      [GRANT_LIKE, PERMISSION.name],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.deletePermissions(queryRunner, [CreateLeaveLedger1860000000105.PERMISSION.name]);

    const [{ backup }] = await queryRunner.query(
      `SELECT to_regclass('public.leave_balances_before_ledger') IS NOT NULL AS backup`,
    );
    if (backup) {
      await queryRunner.query(
        `UPDATE leave_balances lb
            SET "totalAllocated" = b."totalAllocated", consumed = b.consumed, "updatedAt" = NOW()
           FROM leave_balances_before_ledger b
          WHERE b.id = lb.id`,
      );
      await queryRunner.query(`DROP TABLE leave_balances_before_ledger`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS leave_ledger_entries`);
  }
}
