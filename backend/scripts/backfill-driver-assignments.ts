/* eslint-disable no-console */
/**
 * Seeds driver_day_assignments from the engineer already recorded on historical attendance rows.
 *
 * Runs as a dry run by default and prints exactly what it would write. Pass --apply to commit.
 *
 *   npx ts-node -P tsconfig.json -r tsconfig-paths/register scripts/backfill-driver-assignments.ts
 *   npx ts-node -P tsconfig.json -r tsconfig-paths/register scripts/backfill-driver-assignments.ts --apply
 *
 * Two rules keep this honest, and they are the point of the script:
 *
 *  1. Only drivers whose history names ONE engineer throughout are seeded. The whole reason this
 *     feature exists is that drivers picked the wrong engineer, so a driver whose history shows
 *     several is exactly the case we must not guess at — those are listed for a supervisor to
 *     confirm, and nothing is written for them.
 *
 *  2. Days inside a generated payroll month are skipped. Seeding those would change who the
 *     allowance is attributed to for a month that has already been paid.
 */
import { config } from 'dotenv';
import { ConfigService } from 'src/utils/config/config.service';
import { closeDatabaseTunnel } from 'src/utils/ssh-tunnel/ssh-tunnel';
import { DataSource } from 'typeorm';

config();

const APPLY = process.argv.includes('--apply');

/**
 * Closes the connection and the SSH tunnel. Without the tunnel close the process keeps a listener
 * open and never exits, which matters for a one-shot script far more than for the server.
 */
async function shutdown(ds: DataSource): Promise<void> {
  await ds.destroy();
  await closeDatabaseTunnel();
}

interface HistoryRow {
  driverId: string;
  driverName: string;
  engineerId: string;
  engineerName: string;
  workDate: string;
  days: number;
}

async function main(): Promise<void> {
  const options = await ConfigService.resolveOrmConfig('backfill_driver_assignments', true);
  // The app logs every statement, which buries the report this script exists to print.
  const ds = await new DataSource({ ...options, logging: false }).initialize();

  const db = String((options as { database?: string }).database ?? '');
  console.log(`database : ${db}`);
  console.log(`mode     : ${APPLY ? 'APPLY — rows will be written' : 'DRY RUN — nothing written'}\n`);

  // Every driver/engineer/day the old snapshots recorded. Restricted to days the driver actually
  // worked: a pairing on an absent or leave day would be meaningless.
  const history: HistoryRow[] = await ds.query(`
    SELECT a."userId"                                            AS "driverId",
           TRIM(CONCAT(du."firstName", ' ', du."lastName"))      AS "driverName",
           a."assignmentSnapshot"->'assignedEngineer'->>'id'     AS "engineerId",
           TRIM(CONCAT(eu."firstName", ' ', eu."lastName"))      AS "engineerName",
           to_char(a."attendanceDate", 'YYYY-MM-DD')             AS "workDate",
           1                                                     AS days
    FROM attendances a
    INNER JOIN users du ON du.id = a."userId" AND du."deletedAt" IS NULL
    INNER JOIN users eu
            ON eu.id = (a."assignmentSnapshot"->'assignedEngineer'->>'id')::uuid
           AND eu."deletedAt" IS NULL
    WHERE a."deletedAt" IS NULL
      AND a."isActive" = true
      AND a."status" IN ('present', 'checkedIn', 'checkedOut', 'halfDay', 'approvalPending')
      AND a."assignmentSnapshot"->'assignedEngineer'->>'id' IS NOT NULL
      AND a."assignmentSnapshot"->'assignedEngineer'->>'id' <> ''
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        INNER JOIN roles r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
        WHERE ur."userId" = a."userId" AND r.name = 'DRIVER' AND ur."deletedAt" IS NULL
      )
    ORDER BY a."userId", a."attendanceDate"
  `);

  if (history.length === 0) {
    console.log('No historical pairings found. Nothing to seed.');
    await shutdown(ds);
    return;
  }

  // Group by driver so each one's history can be judged as a whole.
  const byDriver = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const rows = byDriver.get(row.driverId) ?? [];
    rows.push(row);
    byDriver.set(row.driverId, rows);
  }

  const clean: HistoryRow[] = [];
  const ambiguous: Array<{ name: string; engineers: Map<string, number> }> = [];

  for (const rows of byDriver.values()) {
    const engineers = new Map<string, number>();
    for (const row of rows) {
      engineers.set(row.engineerName, (engineers.get(row.engineerName) ?? 0) + 1);
    }

    if (engineers.size === 1) {
      clean.push(...rows);
    } else {
      ambiguous.push({ name: rows[0].driverName, engineers });
    }
  }

  // Skip anything inside a month that has already been paid.
  const skipped: HistoryRow[] = [];
  const seedable: HistoryRow[] = [];
  for (const row of clean) {
    const [locked] = await ds.query(
      `SELECT status FROM payroll
       WHERE "userId" = $1
         AND month = EXTRACT(MONTH FROM $2::date) AND year = EXTRACT(YEAR FROM $2::date)
         AND status <> 'CANCELLED' AND "deletedAt" IS NULL
       LIMIT 1`,
      [row.driverId, row.workDate],
    );
    (locked ? skipped : seedable).push(row);
  }

  console.log('SEEDABLE — one consistent engineer, payroll open');
  const summary = new Map<string, { engineer: string; days: number; from: string; to: string }>();
  for (const row of seedable) {
    const entry = summary.get(row.driverName) ?? {
      engineer: row.engineerName,
      days: 0,
      from: row.workDate,
      to: row.workDate,
    };
    entry.days += 1;
    if (row.workDate < entry.from) entry.from = row.workDate;
    if (row.workDate > entry.to) entry.to = row.workDate;
    summary.set(row.driverName, entry);
  }
  if (summary.size === 0) {
    console.log('  (none)');
  }
  for (const [driver, e] of summary) {
    console.log(`  ${driver} → ${e.engineer}   ${e.days} day(s)   ${e.from} .. ${e.to}`);
  }

  console.log('\nNEEDS A SUPERVISOR — history names more than one engineer, nothing written');
  if (ambiguous.length === 0) {
    console.log('  (none)');
  }
  for (const entry of ambiguous) {
    const detail = [...entry.engineers.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} (${count})`)
      .join(', ');
    console.log(`  ${entry.name} → ${detail}`);
  }

  if (skipped.length > 0) {
    console.log(`\nSKIPPED — inside a generated payroll month: ${skipped.length} day(s)`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write the seedable rows.');
    await shutdown(ds);
    return;
  }

  let written = 0;
  let conflicts = 0;
  await ds.transaction(async (em) => {
    for (const row of seedable) {
      // ON CONFLICT rather than a pre-check: the unique index is the authority, and re-running the
      // script must be safe.
      const result = await em.query(
        `INSERT INTO driver_day_assignments ("driverId", "engineerId", "workDate", "createdBy")
         VALUES ($1, $2, $3::date, $2)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [row.driverId, row.engineerId, row.workDate],
      );
      result.length > 0 ? written++ : conflicts++;
    }
  });

  console.log(`\nWritten  : ${written}`);
  console.log(`Already present : ${conflicts}`);
  await ds.destroy();
}

main().catch((error) => {
  console.error('Backfill failed:', error?.message ?? error);
  process.exit(1);
});
