import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateDelegationDto, GetDelegationsDto } from './dto/user-delegation.dto';
import {
  DELEGATABLE_MODULES,
  USER_DELEGATION_ERRORS,
  USER_DELEGATION_RESPONSES,
} from './constants/user-delegation.constants';

/**
 * Granting and withdrawing the right to work on somebody else's entries.
 *
 * Only the office roles reach these endpoints. A manager cannot add members to their own list —
 * if they could, one grant would be enough to reach the whole company.
 */
@Injectable()
export class UserDelegationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private async activeUser(id: string, error: string) {
    const [row] = await this.dataSource.query(
      `SELECT "id", "status", TRIM(CONCAT_WS(' ', "firstName", "lastName")) AS name
         FROM users WHERE "id" = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('Employee not found');
    if (row.status !== 'ACTIVE') throw new BadRequestException(error);
    return row;
  }

  /**
   * One manager, one module, any number of members — one row per member.
   *
   * Input mistakes fail the whole request, so nothing is half-applied: the manager listed as
   * their own member, an id that is not an employee, someone who has left. People this manager
   * already holds for the module are not a mistake — adding five people when one is already
   * there should not need a retry — so they are skipped and reported. Only when *every* member
   * was already held does it refuse, which keeps the single-member case answering as it did.
   */
  async create(dto: CreateDelegationDto, createdBy: string) {
    const memberIds = [...new Set(dto.memberIds)];
    if (memberIds.includes(dto.managerId)) {
      throw new BadRequestException(USER_DELEGATION_ERRORS.SELF_DELEGATION);
    }

    // Both ends must be live people. A grant over someone who has left would be a door nobody
    // ever closes, and a grant to someone who has left is simply dead weight.
    await this.activeUser(dto.managerId, USER_DELEGATION_ERRORS.MANAGER_NOT_ACTIVE);

    const people: Array<{ id: string; status: string; name: string }> = await this.dataSource.query(
      `SELECT "id", "status", TRIM(CONCAT_WS(' ', "firstName", "lastName")) AS name
         FROM users WHERE "id" = ANY($1::uuid[]) AND "deletedAt" IS NULL`,
      [memberIds],
    );
    const missing = memberIds.filter((id) => !people.some((p) => p.id === id));
    if (missing.length) {
      throw new NotFoundException(
        USER_DELEGATION_ERRORS.MEMBERS_NOT_FOUND.replace('{ids}', missing.join(', ')),
      );
    }
    const inactive = people.filter((p) => p.status !== 'ACTIVE');
    if (inactive.length) {
      throw new BadRequestException(
        USER_DELEGATION_ERRORS.MEMBERS_NOT_ACTIVE.replace(
          '{names}',
          inactive.map((p) => p.name).join(', '),
        ),
      );
    }

    const held: Array<{ memberId: string }> = await this.dataSource.query(
      `SELECT "memberId" FROM user_module_delegations
        WHERE "managerId" = $1 AND "memberId" = ANY($2::uuid[]) AND "module" = $3
          AND "deletedAt" IS NULL AND "effectiveTo" IS NULL`,
      [dto.managerId, memberIds, dto.module],
    );
    const alreadyHeld = new Set(held.map((h) => h.memberId));
    const toGrant = memberIds.filter((id) => !alreadyHeld.has(id));
    if (!toGrant.length) throw new BadRequestException(USER_DELEGATION_ERRORS.ALREADY_DELEGATED);

    // ON CONFLICT covers two admins granting the same pair at the same moment: the second
    // simply finds it already there, instead of a 500 from the unique index.
    const inserted: Array<{ id: string; memberId: string }> = await this.dataSource.transaction(
      (em) =>
        em.query(
          `INSERT INTO user_module_delegations
             ("managerId","memberId","module","effectiveFrom","effectiveTo",remarks,"createdBy")
           SELECT $1, m, $3, COALESCE($4::date, CURRENT_DATE), $5::date, $6, $7
             FROM unnest($2::uuid[]) AS m
           ON CONFLICT ("managerId","memberId","module")
             WHERE "deletedAt" IS NULL AND "effectiveTo" IS NULL
           DO NOTHING
           RETURNING "id", "memberId"`,
          [
            dto.managerId,
            toGrant,
            dto.module,
            dto.effectiveFrom ?? null,
            dto.effectiveTo ?? null,
            dto.remarks ?? null,
            createdBy,
          ],
        ),
    );

    const name = (id: string) => people.find((p) => p.id === id)?.name ?? null;
    const createdIds = new Set(inserted.map((r) => r.memberId));
    return {
      message: USER_DELEGATION_RESPONSES.CREATED.replace('{count}', String(inserted.length)),
      created: inserted.map((r) => ({
        id: r.id,
        memberId: r.memberId,
        memberName: name(r.memberId),
      })),
      skipped: memberIds
        .filter((id) => !createdIds.has(id))
        .map((id) => ({ memberId: id, memberName: name(id), reason: 'already delegated' })),
    };
  }

  async findAll(query: GetDelegationsDto) {
    const rows = await this.dataSource.query(
      `SELECT d."id", d."module", d."effectiveFrom", d."effectiveTo", d."remarks",
              d."createdAt",
              d."managerId", TRIM(CONCAT_WS(' ', mg."firstName", mg."lastName")) AS "managerName",
              mg."employeeId" AS "managerEmployeeId",
              d."memberId",  TRIM(CONCAT_WS(' ', mb."firstName", mb."lastName")) AS "memberName",
              mb."employeeId" AS "memberEmployeeId",
              TRIM(CONCAT_WS(' ', cb."firstName", cb."lastName")) AS "grantedBy",
              (d."effectiveFrom" <= CURRENT_DATE
               AND (d."effectiveTo" IS NULL OR d."effectiveTo" >= CURRENT_DATE)) AS "isActive"
         FROM user_module_delegations d
         JOIN users mg ON mg."id" = d."managerId"
         JOIN users mb ON mb."id" = d."memberId"
         LEFT JOIN users cb ON cb."id" = d."createdBy"
        WHERE d."deletedAt" IS NULL
          AND ($1::text IS NULL OR d."module" = $1::text)
          AND ($2::uuid IS NULL OR d."managerId" = $2::uuid)
          AND ($3::uuid IS NULL OR d."memberId" = $3::uuid)
          AND ($4::boolean IS NOT TRUE
               OR (d."effectiveFrom" <= CURRENT_DATE
                   AND (d."effectiveTo" IS NULL OR d."effectiveTo" >= CURRENT_DATE)))
        ORDER BY d."createdAt" DESC`,
      [
        query.module ?? null,
        query.managerId ?? null,
        query.memberId ?? null,
        query.activeOnly === 'true',
      ],
    );
    return { records: rows, totalRecords: rows.length };
  }

  /**
   * Withdraw a grant.
   *
   * Ends it today rather than deleting the row: entries already filed under it stay explainable,
   * and "who was allowed to do this in August" remains an answerable question.
   */
  async withdraw(id: string, updatedBy: string) {
    const [row] = await this.dataSource.query(
      `SELECT "id", "effectiveFrom" FROM user_module_delegations
        WHERE "id" = $1 AND "deletedAt" IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException(USER_DELEGATION_ERRORS.NOT_FOUND);

    // Dated *and* soft-deleted. The date records when it ended, which keeps "who was allowed to
    // do this in August" answerable; the soft delete is what makes it stop *now* — the resolver
    // counts a grant valid through its end date, so dating it alone would leave it working until
    // midnight.
    //
    // GREATEST because a grant withdrawn before it ever started would otherwise leave
    // effectiveTo < effectiveFrom, which the table refuses.
    await this.dataSource.query(
      `UPDATE user_module_delegations
          SET "effectiveTo" = GREATEST(CURRENT_DATE, "effectiveFrom"),
              "deletedAt" = now(),
              "deletedBy" = $2,
              "updatedBy" = $2,
              "updatedAt" = now()
        WHERE "id" = $1`,
      [id, updatedBy],
    );
    return { message: USER_DELEGATION_RESPONSES.WITHDRAWN, id };
  }

  /** Everything this module governs, for an admin screen's dropdowns. */
  supportedModules() {
    return { modules: Object.values(DELEGATABLE_MODULES) };
  }
}
