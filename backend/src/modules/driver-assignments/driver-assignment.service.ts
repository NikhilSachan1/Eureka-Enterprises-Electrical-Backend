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
   * Claims one driver for the day. The unique index is what actually decides conflicts — checking
   * first and then inserting would leave a race between two engineers checking in at once, so the
   * violation is caught and translated instead.
   */
  private async claim(
    driverId: string,
    engineerId: string,
    dateStr: string,
    actor: string,
    em?: EntityManager,
  ): Promise<void> {
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

      const holder = await this.findHolder(driverId, dateStr, em);
      const [driver] = await (em ?? this.dataSource).query(
        `SELECT TRIM(CONCAT("firstName", ' ', "lastName")) AS name FROM users WHERE id = $1`,
        [driverId],
      );

      throw new BadRequestException(
        DRIVER_ASSIGNMENT_ERRORS.ALREADY_CLAIMED.replace('{driver}', driver?.name ?? 'That driver')
          .replace('{engineer}', holder?.engineerName ?? 'another engineer')
          .replace('{date}', dateStr),
      );
    }
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
