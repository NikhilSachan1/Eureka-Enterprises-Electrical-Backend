import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { DriverAssignmentEntity } from './entities/driver-assignment.entity';
import { DRIVER_ASSIGNMENT_ERRORS } from './constants/driver-assignment.constants';

/** Postgres unique-violation SQLSTATE — the pairing conflict surfaces as this. */
const UNIQUE_VIOLATION = '23505';

/**
 * Attendance statuses that mean the person actually worked. Deliberately not "anything except
 * absent": a day still sitting at checkedIn, checkedOut, halfDay or approvalPending is a worked
 * day that simply has not been finalised yet.
 */
const WORKED_STATUSES = ['present', 'checkedIn', 'checkedOut', 'halfDay', 'approvalPending'];

/** The snapshot shape attendance stores — kept identical so nothing downstream changes. */
export interface AssignedEngineerSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
}

/**
 * The engineer a driver was with, plus the site context that engineer recorded for that day.
 *
 * A driver has no site context of his own to give — he is wherever his engineer was — so these
 * fields are inherited rather than asked for. Shapes mirror `attendances.assignmentSnapshot`
 * exactly, so a caller can spread them straight onto a snapshot.
 */
export interface DriverAssignmentContext {
  engineer: AssignedEngineerSnapshot | null;
  site?: { id: string; name: string; fullAddress?: string };
  company?: { id: string; name: string; fullAddress?: string };
  contractors?: Array<{ id: string; name: string }>;
  vehicle?: { id: string; registrationNo: string };
}

@Injectable()
export class DriverAssignmentService {
  private readonly logger = new Logger(DriverAssignmentService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo(em?: EntityManager) {
    return (em ?? this.dataSource).getRepository(DriverAssignmentEntity);
  }

  /**
   * The engineer a driver was paired with on a given day, in the shape attendance stores.
   *
   * This is the single place `assignedEngineer` is derived. Check-in, force attendance and
   * regularize all route through here and none of them may read the engineer off the request
   * body — three independent derivations is exactly how the field ended up on non-driver records
   * before.
   *
   * Returns null when the user is not a driver, has no pairing that day, or the paired engineer
   * no longer exists. Null is a normal outcome, not an error: the allowance then stays with the
   * driver, which is the pre-existing fallback.
   */
  async resolveAssignedEngineer(
    driverId: string,
    workDate: Date | string,
    em?: EntityManager,
  ): Promise<AssignedEngineerSnapshot | null> {
    const dateStr = this.toDateString(workDate);

    // The engineer must also have actually worked that day. An engineer later marked absent,
    // rejected or deleted cannot have had a driver with him, so the pairing stops resolving and
    // the allowance falls back to the driver — which is the agreed behaviour, expressed here once
    // rather than as a separate reconciliation job. It is self-healing too: correcting the
    // engineer's day back to present makes the pairing resolve again.
    const [row] = await (em ?? this.dataSource).query(
      `SELECT u."id", u."firstName", u."lastName", u."employeeId"
       FROM "driver_day_assignments" da
       INNER JOIN "users" u ON u."id" = da."engineerId" AND u."deletedAt" IS NULL
       INNER JOIN "attendances" a
               ON a."userId" = da."engineerId"
              AND a."attendanceDate" = da."workDate"
              AND a."isActive" = true
              AND a."deletedAt" IS NULL
              AND a."status" = ANY($3)
       WHERE da."driverId" = $1
         AND da."workDate" = $2::date
         AND da."deletedAt" IS NULL
       LIMIT 1`,
      [driverId, dateStr, WORKED_STATUSES],
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      employeeId: row.employeeId,
    };
  }

  /**
   * The engineer **and** his recorded site context for a driver's day.
   *
   * Same pairing conditions as `resolveAssignedEngineer` — including the worked-status filter — so
   * the two can never disagree about whether a pairing resolves. The only addition is reading the
   * engineer's own `assignmentSnapshot` off the row it already joins to.
   *
   * Returns null on exactly the same terms as `resolveAssignedEngineer`: not a driver, nobody
   * claimed them that day, or the paired engineer's day no longer counts as worked.
   */
  async resolveAssignmentContext(
    driverId: string,
    workDate: Date | string,
    em?: EntityManager,
  ): Promise<DriverAssignmentContext | null> {
    const dateStr = this.toDateString(workDate);

    const [row] = await (em ?? this.dataSource).query(
      `SELECT u."id", u."firstName", u."lastName", u."employeeId",
              a."assignmentSnapshot" AS "engineerSnapshot"
       FROM "driver_day_assignments" da
       INNER JOIN "users" u ON u."id" = da."engineerId" AND u."deletedAt" IS NULL
       INNER JOIN "attendances" a
               ON a."userId" = da."engineerId"
              AND a."attendanceDate" = da."workDate"
              AND a."isActive" = true
              AND a."deletedAt" IS NULL
              AND a."status" = ANY($3)
       WHERE da."driverId" = $1
         AND da."workDate" = $2::date
         AND da."deletedAt" IS NULL
       LIMIT 1`,
      [driverId, dateStr, WORKED_STATUSES],
    );

    if (!row) {
      return null;
    }

    // node-pg parses jsonb already. An engineer whose row was created by the midnight cron has a
    // null snapshot — the context is then just the engineer, and the caller keeps whatever the
    // driver already had rather than having it wiped.
    const engineerSnapshot = (row.engineerSnapshot ?? {}) as DriverAssignmentContext;

    return {
      engineer: {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        employeeId: row.employeeId,
      },
      site: engineerSnapshot.site,
      company: engineerSnapshot.company,
      contractors: engineerSnapshot.contractors,
      vehicle: engineerSnapshot.vehicle,
    };
  }

  /**
   * The drivers paired with each engineer/day in one query, keyed `engineerId|YYYY-MM-DD`.
   *
   * Batched on purpose: a list endpoint returning a month of rows would otherwise issue a query per
   * row for a field that is empty on most of them.
   */
  async loadDriversFor(
    pairs: Array<{ engineerId: string; workDate: Date | string }>,
    em?: EntityManager,
  ): Promise<Map<string, AssignedEngineerSnapshot[]>> {
    const result = new Map<string, AssignedEngineerSnapshot[]>();
    if (pairs.length === 0) {
      return result;
    }

    const engineerIds = [...new Set(pairs.map((p) => p.engineerId))];
    const dates = [...new Set(pairs.map((p) => this.toDateString(p.workDate)))];

    const rows = await (em ?? this.dataSource).query(
      `SELECT dda."engineerId",
              to_char(dda."workDate", 'YYYY-MM-DD') AS "workDate",
              du."id", du."firstName", du."lastName", du."employeeId"
       FROM "driver_day_assignments" dda
       INNER JOIN "users" du ON du."id" = dda."driverId" AND du."deletedAt" IS NULL
       WHERE dda."engineerId" = ANY($1)
         AND dda."workDate" = ANY($2::date[])
         AND dda."deletedAt" IS NULL
       ORDER BY du."firstName"`,
      [engineerIds, dates],
    );

    for (const row of rows) {
      const key = `${row.engineerId}|${row.workDate}`;
      const list = result.get(key) ?? [];
      list.push({
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        employeeId: row.employeeId,
      });
      result.set(key, list);
    }

    return result;
  }

  /** The key `loadDriversFor` returns its map under. */
  driverMapKey(engineerId: string, workDate: Date | string): string {
    return `${engineerId}|${this.toDateString(workDate)}`;
  }

  /** Who currently holds this driver on this day, if anyone. Used for the duplicate-claim error. */
  async findHolder(
    driverId: string,
    workDate: Date | string,
    em?: EntityManager,
  ): Promise<{ engineerId: string; engineerName: string } | null> {
    const [row] = await (em ?? this.dataSource).query(
      `SELECT u."id", TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS name
       FROM "driver_day_assignments" da
       INNER JOIN "users" u ON u."id" = da."engineerId"
       WHERE da."driverId" = $1 AND da."workDate" = $2::date AND da."deletedAt" IS NULL
       LIMIT 1`,
      [driverId, this.toDateString(workDate)],
    );

    return row ? { engineerId: row.id, engineerName: row.name } : null;
  }

  /**
   * Makes the stored pairings for this engineer and day match `driverIds` exactly: claims the ones
   * that are new, releases the ones he no longer lists.
   *
   * Written as a sync rather than a plain insert because regularize is the correction path — an
   * engineer re-submitting his day with one driver swapped must both release the old and claim the
   * new, and doing that in one place keeps the two halves from drifting apart.
   *
   * Returns the drivers whose pairing actually changed, so the caller knows whose allowance needs
   * re-routing.
   */
  async syncClaims(params: {
    engineerId: string;
    workDate: Date | string;
    driverIds: string[];
    actor: string;
    entityManager?: EntityManager;
  }): Promise<{ claimed: string[]; released: string[] }> {
    const { engineerId, workDate, driverIds, actor, entityManager } = params;
    const dateStr = this.toDateString(workDate);
    const requested = [...new Set(driverIds)];

    if (requested.includes(engineerId)) {
      throw new BadRequestException(DRIVER_ASSIGNMENT_ERRORS.SELF_ASSIGNMENT);
    }

    await this.assertAllAreDrivers(requested, entityManager);

    const existing = await this.findByEngineer(engineerId, dateStr, entityManager);
    const existingIds = existing.map((row) => row.driverId);

    const toClaim = requested.filter((id) => !existingIds.includes(id));
    const toRelease = existingIds.filter((id) => !requested.includes(id));

    for (const driverId of toRelease) {
      await this.release(driverId, dateStr, actor, entityManager);
    }

    for (const driverId of toClaim) {
      await this.claim(driverId, engineerId, dateStr, actor, entityManager);
    }

    return { claimed: toClaim, released: toRelease };
  }

  /**
   * Claims one driver for the day.
   *
   * Conflicts are decided in two layers. The check below catches the ordinary case — somebody else
   * already holds this driver — and reports it before anything is written. The unique index remains
   * the real arbiter for the race where two engineers claim the same driver at the same instant,
   * and that violation is translated in the catch.
   *
   * The catch cannot read through `em`: a constraint violation aborts the enclosing transaction, so
   * every subsequent statement on that connection fails with 25P02 and the friendly message is
   * never built — the caller got a 500 instead. The lookups therefore go over a fresh connection,
   * which is safe because a row that won the index race is by definition committed.
   */
  private async claim(
    driverId: string,
    engineerId: string,
    dateStr: string,
    actor: string,
    em?: EntityManager,
  ): Promise<void> {
    const existingHolder = await this.findHolder(driverId, dateStr, em);
    if (existingHolder) {
      throw new BadRequestException(
        await this.alreadyClaimedMessage(driverId, dateStr, existingHolder.engineerName, em),
      );
    }

    try {
      await this.repo(em).insert({
        driverId,
        engineerId,
        workDate: dateStr as unknown as Date,
        createdBy: actor,
        updatedBy: actor,
      });
    } catch (error) {
      if ((error as { code?: string })?.code !== UNIQUE_VIOLATION) {
        throw error;
      }

      // Deliberately NOT passing `em` — see the note above.
      const holder = await this.findHolder(driverId, dateStr).catch(() => null);
      throw new BadRequestException(
        await this.alreadyClaimedMessage(driverId, dateStr, holder?.engineerName),
      );
    }
  }

  /**
   * Builds the ALREADY_CLAIMED text. `em` is passed only when the transaction is still healthy;
   * on the post-violation path it is omitted so the read goes over a fresh connection, and any
   * further failure degrades to generic wording rather than replacing a 400 with a 500.
   */
  private async alreadyClaimedMessage(
    driverId: string,
    dateStr: string,
    engineerName?: string,
    em?: EntityManager,
  ): Promise<string> {
    let driverName: string | undefined;
    try {
      const [driver] = await (em ?? this.dataSource).query(
        `SELECT TRIM(CONCAT("firstName", ' ', "lastName")) AS name FROM users WHERE id = $1`,
        [driverId],
      );
      driverName = driver?.name;
    } catch {
      driverName = undefined;
    }

    return DRIVER_ASSIGNMENT_ERRORS.ALREADY_CLAIMED.replace('{driver}', driverName || 'That driver')
      .replace('{engineer}', engineerName || 'another engineer')
      .replace('{date}', dateStr);
  }

  /** Soft-deletes the pairing so the driver becomes claimable again that same day. */
  async release(
    driverId: string,
    workDate: Date | string,
    actor: string,
    em?: EntityManager,
  ): Promise<void> {
    const dateStr = this.toDateString(workDate);
    await (em ?? this.dataSource).query(
      `UPDATE "driver_day_assignments"
       SET "deletedAt" = NOW(), "deletedBy" = $3, "updatedBy" = $3
       WHERE "driverId" = $1 AND "workDate" = $2::date AND "deletedAt" IS NULL`,
      [driverId, dateStr, actor],
    );
  }

  /** Rejects anyone in the list who does not hold the DRIVER role, naming them. */
  private async assertAllAreDrivers(driverIds: string[], em?: EntityManager): Promise<void> {
    if (driverIds.length === 0) {
      return;
    }

    const rows = await (em ?? this.dataSource).query(
      `SELECT u."id", TRIM(CONCAT(u."firstName", ' ', u."lastName")) AS name,
              EXISTS (
                SELECT 1 FROM user_roles ur
                INNER JOIN roles r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
                WHERE ur."userId" = u.id AND r.name = 'DRIVER' AND ur."deletedAt" IS NULL
              ) AS is_driver
       FROM users u
       WHERE u.id = ANY($1) AND u."deletedAt" IS NULL`,
      [driverIds],
    );

    const offender = rows.find((row: { is_driver: boolean }) => !row.is_driver);
    if (offender) {
      throw new BadRequestException(
        DRIVER_ASSIGNMENT_ERRORS.NOT_A_DRIVER.replace('{name}', offender.name),
      );
    }

    if (rows.length !== driverIds.length) {
      throw new BadRequestException(DRIVER_ASSIGNMENT_ERRORS.NOT_FOUND);
    }
  }

  /** Every driver an engineer has claimed for a day. */
  async findByEngineer(
    engineerId: string,
    workDate: Date | string,
    em?: EntityManager,
  ): Promise<DriverAssignmentEntity[]> {
    return this.repo(em).find({
      where: {
        engineerId,
        workDate: this.toDateString(workDate) as unknown as Date,
        deletedAt: IsNull(),
      },
    });
  }

  /**
   * Attendance stores dates as `date` columns, which the driver may hand back as a string or a
   * Date depending on the path. Normalising here keeps every caller from having to care.
   */
  private toDateString(value: Date | string): string {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    // Use the local calendar day rather than the UTC one — an IST midnight Date would otherwise
    // resolve to the previous date.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
