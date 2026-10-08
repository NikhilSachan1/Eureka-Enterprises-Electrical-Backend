import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions } from 'typeorm';
import { SiteAllocationRepository } from './site-allocation.repository';
import { SiteAllocationEntity } from './entities/site-allocation.entity';
import {
  CreateSiteAllocationDto,
  UpdateSiteAllocationDto,
  DeallocateSiteDto,
  GetSiteAllocationDto,
  GetEmployeeOverviewDto,
  ManageSiteAllocationDto,
} from './dto';
import {
  overlappingAllocationsQuery,
  openEndedAllocationsBeforeQuery,
  attendanceDaysInRangeQuery,
  generatedPayrollMonthsInRangeQuery,
} from './queries/site-allocation.queries';
import {
  SITE_ALLOCATION_ERRORS,
  SITE_ALLOCATION_RESPONSES,
  SiteAllocationEntityFields,
  SITE_ALLOCATION_DEFAULTS,
} from './constants/site-allocation.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import { Roles } from '../roles/constants/role.constants';
import { SiteService } from '../sites/site.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

@Injectable()
export class SiteAllocationService {
  /**
   * Roles that make someone allocatable field staff. Anyone holding a role outside this set is
   * office staff and is kept out of the allocation pool — see getEmployeeOverview().
   */
  private static readonly FIELD_STAFF_ROLES = [Roles.EMPLOYEE, Roles.DRIVER];

  constructor(
    private readonly siteAllocationRepository: SiteAllocationRepository,
    private readonly siteService: SiteService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  /**
   * A calendar day as a Date, anchored at local noon.
   *
   * These columns hold a day, not an instant. Parsing '2027-03-01' gives UTC midnight, which in
   * IST is the evening of 28 February — so a stored date, or a date arrived at by subtracting a
   * day, can land on the wrong one. Noon is far enough from both edges that no offset reaches it.
   */
  private dayOf(value: string | Date): Date {
    const iso =
      value instanceof Date
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(
            value.getDate(),
          ).padStart(2, '0')}`
        : String(value).slice(0, 10);
    return new Date(`${iso}T12:00:00`);
  }

  /** A clash between the range being saved and one of the employee's other allocations. */
  private async findClashes(
    userId: string,
    from: Date,
    to: Date | null,
    ignoreAllocationId: string | null,
  ): Promise<Array<{ id: string; siteName: string; overlapDays: number }>> {
    const rows = await this.siteAllocationRepository.raw(overlappingAllocationsQuery, [
      userId,
      from,
      to,
      ignoreAllocationId,
    ]);
    return rows.map((r: any) => ({
      id: r.id,
      siteName: r.siteName,
      overlapDays: Number(r.overlapDays),
    }));
  }

  private describeClashes(clashes: Array<{ siteName: string; overlapDays: number }>): string {
    return clashes
      .map((c) => `${c.siteName} (${c.overlapDays} day${c.overlapDays === 1 ? '' : 's'})`)
      .join(', ');
  }

  private assertValidRange(from: Date, to: Date | null): void {
    if (to && to < from) {
      throw new BadRequestException(SITE_ALLOCATION_ERRORS.INVALID_DATE_RANGE);
    }
  }

  /**
   * Close any open-ended allocation that would otherwise swallow the new one.
   *
   * An open end means "until further notice"; a transfer is that notice. Without this, every
   * transfer would be a two-step job, and the clash check would refuse the second step — which is
   * exactly the trap the old flag-based check had.
   */
  private async closeOpenEndedBefore(
    userId: string,
    newStart: Date,
    updatedBy: string,
  ): Promise<{ siteName: string; closedOn: Date } | null> {
    const rows = await this.siteAllocationRepository.raw(openEndedAllocationsBeforeQuery, [
      userId,
      newStart,
    ]);
    if (!rows.length) return null;

    const closeOn = this.dayOf(newStart);
    closeOn.setDate(closeOn.getDate() - 1);

    for (const row of rows) {
      await this.siteAllocationRepository.update(
        { id: row.id },
        { deallocatedAt: closeOn, isCurrentlyAllocated: false, updatedBy },
      );
    }
    return { siteName: rows[0].siteName, closedOn: closeOn };
  }

  async create(createDto: CreateSiteAllocationDto, createdBy: string) {
    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: createDto.siteId } });

    // Dates, not a flag. The old check asked "is this employee allocated at all?", which refused a
    // backfill for last August because they had a booking for next week. The question that matters
    // is whether they are free **on these dates**.
    const from = this.dayOf(createDto.allocatedAt);
    const to = createDto.deallocatedAt ? this.dayOf(createDto.deallocatedAt) : null;
    this.assertValidRange(from, to);

    // Done before the clash check: an open end covers every future date, so it would clash with
    // everything and no transfer could ever be recorded.
    const closed = await this.closeOpenEndedBefore(createDto.userId, from, createdBy);

    const clashes = await this.findClashes(createDto.userId, from, to, null);
    if (clashes.length) {
      throw new ConflictException(
        SITE_ALLOCATION_ERRORS.DATE_CLASH.replace('{clashes}', this.describeClashes(clashes)),
      );
    }

    // Validate allocation type if provided
    const allocationType = createDto.allocationType || SITE_ALLOCATION_DEFAULTS.ALLOCATION_TYPE;
    await this.validateAllocationType(allocationType);

    // Validate role if provided
    const role = createDto.role || SITE_ALLOCATION_DEFAULTS.ROLE;
    await this.validateSiteRole(role);

    // Create allocation
    await this.siteAllocationRepository.create({
      siteId: createDto.siteId,
      userId: createDto.userId,
      allocationType,
      role,
      dailyAllowance: createDto.dailyAllowance ?? SITE_ALLOCATION_DEFAULTS.DAILY_ALLOWANCE,
      allocatedAt: from,
      deallocatedAt: to,
      // A closed range is history the moment it is written; only an open one is "current".
      isCurrentlyAllocated: to === null,
      remarks: createDto.remarks,
      createdBy,
    });

    const base = this.utilityService.getSuccessMessage(
      SiteAllocationEntityFields.SITE_ALLOCATION,
      DataSuccessOperationType.CREATE,
    );
    if (!closed) return base;

    // Say so rather than closing someone's allocation silently.
    const note = SITE_ALLOCATION_RESPONSES.PREVIOUS_CLOSED.replace(
      '{siteName}',
      closed.siteName,
    ).replace('{date}', closed.closedOn.toISOString().slice(0, 10));
    return { ...base, message: `${(base as any).message ?? ''}${note}`.trim() };
  }

  async findAll(options: GetSiteAllocationDto) {
    const {
      siteId,
      userId,
      allocationType,
      role,
      isCurrentlyAllocated,
      includeSite,
      includeUser,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    const where: any = {
      deletedAt: IsNull(),
    };

    if (siteId) {
      where.siteId = siteId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (allocationType) {
      where.allocationType = allocationType;
    }

    if (role) {
      where.role = ILike(`%${role}%`);
    }

    if (isCurrentlyAllocated !== undefined) {
      where.isCurrentlyAllocated = isCurrentlyAllocated;
    }

    const relations: string[] = [];
    if (includeSite) relations.push('site');
    if (includeUser) relations.push('user');

    const records = await this.siteAllocationRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalRecords = await this.siteAllocationRepository.count({ where });

    return this.utilityService.listResponse(records, totalRecords);
  }

  async findOne(options: FindOneOptions<SiteAllocationEntity>) {
    return await this.siteAllocationRepository.findOne(options);
  }

  async findOneOrFail(
    options: FindOneOptions<SiteAllocationEntity>,
  ): Promise<SiteAllocationEntity> {
    const allocation = await this.siteAllocationRepository.findOne(options);

    if (!allocation) {
      throw new NotFoundException(SITE_ALLOCATION_ERRORS.NOT_FOUND);
    }

    return allocation;
  }

  async findById(id: string, includeRelations = true): Promise<SiteAllocationEntity> {
    const relations = includeRelations ? ['site', 'user'] : [];

    return await this.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async update(id: string, updateDto: UpdateSiteAllocationDto, updatedBy: string) {
    const existingAllocation = await this.findOneOrFail({ where: { id } });

    // A closed allocation is still editable. It used to be refused outright, which was harmless
    // while every allocation was open-ended — but a backfilled stint is closed the moment it is
    // written, and fixing its dates is exactly what this module is being changed to allow. The
    // clash check below is the real guard; refusing the edit only made wrong dates permanent.

    // Validate allocation type if changed
    if (
      updateDto.allocationType &&
      updateDto.allocationType !== existingAllocation.allocationType
    ) {
      await this.validateAllocationType(updateDto.allocationType);
    }

    // Validate role if changed
    if (updateDto.role && updateDto.role !== existingAllocation.role) {
      await this.validateSiteRole(updateDto.role);
    }

    await this.assertDateChangeAllowed(existingAllocation, updateDto);

    // Dates arrive as ISO strings and the column is a Date, so they are converted rather than
    // spread straight through. Sending deallocatedAt as null reopens an allocation, which is why
    // the check is on undefined and not on falsiness.
    const { allocatedAt, deallocatedAt, ...rest } = updateDto;
    const patch: Partial<SiteAllocationEntity> = { ...rest, updatedBy };
    if (allocatedAt !== undefined) patch.allocatedAt = this.dayOf(allocatedAt);
    if (deallocatedAt !== undefined) {
      patch.deallocatedAt = deallocatedAt ? this.dayOf(deallocatedAt) : null;
      // Only an open-ended allocation is "current"; giving it an end date makes it history.
      patch.isCurrentlyAllocated = !deallocatedAt;
    }

    await this.siteAllocationRepository.update({ id }, patch);

    return this.utilityService.getSuccessMessage(
      SiteAllocationEntityFields.SITE_ALLOCATION,
      DataSuccessOperationType.UPDATE,
    );
  }

  /**
   * Let a date change through only if it does not make clashes worse.
   *
   * A flat "no overlap" rule would be right for new allocations and a trap for old ones: there are
   * already hundreds of overlapping rows in the data, and under a strict rule none of them could
   * ever be edited — the rows most in need of fixing would be the first to lock. So the comparison
   * is per clashing allocation, before versus after: a new clash or more shared days is refused,
   * the same or fewer is allowed. Shrinking an existing mess is always possible.
   */
  private async assertDateChangeAllowed(
    existing: SiteAllocationEntity,
    updateDto: UpdateSiteAllocationDto,
  ): Promise<void> {
    const nextFrom =
      updateDto.allocatedAt !== undefined
        ? this.dayOf(updateDto.allocatedAt)
        : this.dayOf(existing.allocatedAt);
    const nextTo =
      updateDto.deallocatedAt !== undefined
        ? updateDto.deallocatedAt
          ? this.dayOf(updateDto.deallocatedAt)
          : null
        : existing.deallocatedAt
        ? this.dayOf(existing.deallocatedAt)
        : null;

    const unchanged =
      nextFrom.getTime() === this.dayOf(existing.allocatedAt).getTime() &&
      (nextTo?.getTime() ?? null) ===
        (existing.deallocatedAt ? this.dayOf(existing.deallocatedAt).getTime() : null);
    if (unchanged) return;

    this.assertValidRange(nextFrom, nextTo);

    const before = await this.findClashes(
      existing.userId,
      this.dayOf(existing.allocatedAt),
      existing.deallocatedAt ? this.dayOf(existing.deallocatedAt) : null,
      existing.id,
    );
    const after = await this.findClashes(existing.userId, nextFrom, nextTo, existing.id);
    if (!after.length) return;

    const beforeDays = new Map(before.map((c) => [c.id, c.overlapDays]));
    const worsened = after.filter((c) => c.overlapDays > (beforeDays.get(c.id) ?? 0));
    if (worsened.length) {
      throw new ConflictException(
        SITE_ALLOCATION_ERRORS.CLASH_WOULD_WORSEN.replace(
          '{clashes}',
          this.describeClashes(worsened),
        ),
      );
    }
  }

  /**
   * Delete an allocation outright — for one that should never have existed.
   *
   * De-allocating is the wrong tool for a mistake: it asks for an end date, and closing a wrong
   * allocation on its own start date still records that the employee was on that site for that
   * day. Delete leaves nothing.
   *
   * Two guards, because "leaves nothing" is exactly what makes it dangerous:
   *  - payroll already generated for a month this allocation covers → refused outright, since the
   *    allocation carries the daily allowance that payslip was built from
   *  - attendance recorded inside the dates → refused once, with the count, until `confirm` is sent
   */
  async remove(id: string, deletedBy: string, confirm = false) {
    const allocation = await this.findOneOrFail({ where: { id } });

    const from = this.dayOf(allocation.allocatedAt);
    const to = allocation.deallocatedAt ? this.dayOf(allocation.deallocatedAt) : null;

    const months = await this.siteAllocationRepository.raw(generatedPayrollMonthsInRangeQuery, [
      allocation.userId,
      from,
      to,
    ]);
    if (months.length) {
      const label = months.map((m: any) => `${m.month}/${m.year}`).join(', ');
      throw new ConflictException(
        SITE_ALLOCATION_ERRORS.DELETE_PAYROLL_GENERATED.replace('{months}', label),
      );
    }

    if (!confirm) {
      const [row] = await this.siteAllocationRepository.raw(attendanceDaysInRangeQuery, [
        allocation.userId,
        from,
        to,
      ]);
      const days = Number(row?.days ?? 0);
      if (days > 0) {
        throw new ConflictException(
          SITE_ALLOCATION_ERRORS.DELETE_CONFIRM_ATTENDANCE.replace('{days}', String(days)),
        );
      }
    }

    await this.siteAllocationRepository.update({ id }, { deletedBy });
    await this.siteAllocationRepository.softDelete({ id });

    return { message: SITE_ALLOCATION_RESPONSES.DELETED };
  }

  async deallocate(id: string, deallocateDto: DeallocateSiteDto, updatedBy: string) {
    const allocation = await this.findOneOrFail({ where: { id } });

    // Already deallocated
    if (!allocation.isCurrentlyAllocated) {
      throw new BadRequestException(SITE_ALLOCATION_ERRORS.CANNOT_UPDATE_DEALLOCATED);
    }

    await this.siteAllocationRepository.update(
      { id },
      {
        deallocatedAt: new Date(deallocateDto.deallocatedAt),
        isCurrentlyAllocated: false,
        remarks: deallocateDto.remarks || allocation.remarks,
        updatedBy,
      },
    );

    return { message: SITE_ALLOCATION_RESPONSES.DEALLOCATED };
  }

  async getCurrentAllocationByUserId(userId: string): Promise<SiteAllocationEntity | null> {
    return await this.findOne({
      where: { userId, isCurrentlyAllocated: true, deletedAt: IsNull() },
      relations: ['site'],
    });
  }

  /**
   * Employee allocation overview: all active employees with their current project (site →
   * company → parent company), Free/Allocated status, and "since". Stats are global
   * (independent of table filters). Filters: allocatedStatus, search (name/code), site.
   */
  async getEmployeeOverview(query: GetEmployeeOverviewDto) {
    const { allocatedStatus, search, siteId, siteName, page, pageSize, sortOrder } = query;

    const conds: string[] = [`u."deletedAt" IS NULL`, `u."status" = 'ACTIVE'`];
    const params: any[] = [];

    // This is the field-staff pool, so office roles are excluded: a person qualifies only if they
    // hold EMPLOYEE or DRIVER and hold nothing else. Holding EMPLOYEE is not enough on its own —
    // admins carry it too, which is why the list previously showed everyone.
    //
    // The `sa.id IS NOT NULL` escape is deliberate: this screen reports Free/Allocated and its
    // stats, so someone who *is* allocated must stay visible even if they hold an office role,
    // otherwise a real allocation silently disappears and the totals stop reconciling.
    params.push(SiteAllocationService.FIELD_STAFF_ROLES);
    const fieldStaffParam = `$${params.length}`;
    conds.push(`(
      sa.id IS NOT NULL
      OR (
        EXISTS (
          SELECT 1 FROM "user_roles" ur
            INNER JOIN "roles" r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
           WHERE ur."userId" = u.id AND ur."deletedAt" IS NULL AND r."name" = ANY(${fieldStaffParam})
        )
        AND NOT EXISTS (
          SELECT 1 FROM "user_roles" ur
            INNER JOIN "roles" r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
           WHERE ur."userId" = u.id AND ur."deletedAt" IS NULL AND r."name" <> ALL(${fieldStaffParam})
        )
      )
    )`);
    if (allocatedStatus === 'ALLOCATED') conds.push(`sa.id IS NOT NULL`);
    else if (allocatedStatus === 'FREE') conds.push(`sa.id IS NULL`);
    if (search) {
      params.push(`%${search}%`);
      const p = `$${params.length}`;
      conds.push(
        `(u."firstName" ILIKE ${p} OR u."lastName" ILIKE ${p} OR u."employeeId" ILIKE ${p}
          OR CONCAT(u."firstName", ' ', COALESCE(u."lastName", '')) ILIKE ${p})`,
      );
    }
    if (siteId) {
      params.push(siteId);
      conds.push(`sa."siteId" = $${params.length}`);
    }
    if (siteName) {
      params.push(`%${siteName}%`);
      conds.push(`s."name" ILIKE $${params.length}`);
    }

    const joins = `
      FROM "users" u
      LEFT JOIN "site_allocations" sa ON sa."userId" = u.id AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL
      LEFT JOIN "sites" s ON s.id = sa."siteId" AND s."deletedAt" IS NULL
      LEFT JOIN "companies" c ON c.id = s."companyId" AND c."deletedAt" IS NULL
      LEFT JOIN "companies" pc ON pc.id = c."parentCompanyId" AND pc."deletedAt" IS NULL
      WHERE ${conds.join(' AND ')}`;

    const order = String(sortOrder ?? '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Pagination is optional: omit pageSize → return ALL records (no LIMIT/OFFSET).
    const recordParams = [...params];
    let limitClause = '';
    if (pageSize !== undefined && pageSize !== null) {
      const pg = page && page > 0 ? page : 1;
      recordParams.push(pageSize, (pg - 1) * pageSize);
      limitClause = ` LIMIT $${recordParams.length - 1} OFFSET $${recordParams.length}`;
    }

    const recordsSql = `
      SELECT u.id AS "userId",
        TRIM(CONCAT(u."firstName", ' ', COALESCE(u."lastName", ''))) AS "employeeName",
        u."employeeId" AS "employeeCode",
        CASE WHEN sa.id IS NOT NULL THEN 'ALLOCATED' ELSE 'FREE' END AS "status",
        sa.id AS "allocationId", sa."role" AS "projectRole",
        sa."siteId", s."name" AS "siteName",
        s."city" AS "siteCity", s."state" AS "siteState",
        s."startDate" AS "siteStartDate", s."endDate" AS "siteEndDate",
        c.id AS "companyId", c."name" AS "companyName",
        c."city" AS "companyCity", c."state" AS "companyState",
        pc.id AS "parentCompanyId", pc."name" AS "parentCompanyName",
        sa."allocatedAt" AS "since"
      ${joins}
      ORDER BY "employeeName" ${order}${limitClause}`;

    const countSql = `SELECT COUNT(DISTINCT u.id)::int AS total ${joins}`;

    // Stats stay global (they ignore the table filters), but they must count the same population
    // the table can ever show — otherwise total/allocated/free describe a different set of people
    // than the rows underneath them.
    const statsSql = `
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE sa.id IS NOT NULL)::int AS allocated,
        COUNT(*) FILTER (WHERE sa.id IS NULL)::int AS free
      FROM "users" u
      LEFT JOIN "site_allocations" sa ON sa."userId" = u.id AND sa."isCurrentlyAllocated" = true AND sa."deletedAt" IS NULL
      WHERE u."deletedAt" IS NULL AND u."status" = 'ACTIVE'
        AND (
          sa.id IS NOT NULL
          OR (
            EXISTS (
              SELECT 1 FROM "user_roles" ur
                INNER JOIN "roles" r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
               WHERE ur."userId" = u.id AND ur."deletedAt" IS NULL AND r."name" = ANY($1)
            )
            AND NOT EXISTS (
              SELECT 1 FROM "user_roles" ur
                INNER JOIN "roles" r ON r.id = ur."roleId" AND r."deletedAt" IS NULL
               WHERE ur."userId" = u.id AND ur."deletedAt" IS NULL AND r."name" <> ALL($1)
            )
          )
        )`;

    const [rows, countRows, statsRows] = await Promise.all([
      this.siteAllocationRepository.raw(recordsSql, recordParams),
      this.siteAllocationRepository.raw(countSql, params),
      this.siteAllocationRepository.raw(statsSql, [SiteAllocationService.FIELD_STAFF_ROLES]),
    ]);

    const s = statsRows[0] ?? {};
    return {
      stats: {
        total: Number(s.total ?? 0),
        allocated: Number(s.allocated ?? 0),
        free: Number(s.free ?? 0),
      },
      records: rows.map((r: any) => ({
        userId: r.userId,
        employeeName: r.employeeName,
        employeeCode: r.employeeCode ?? null,
        status: r.status,
        currentProject: r.siteId
          ? {
              allocationId: r.allocationId,
              projectRole: r.projectRole ?? null,
              siteId: r.siteId,
              siteName: r.siteName,
              city: r.siteCity ?? null,
              state: r.siteState ?? null,
              startDate: r.siteStartDate ?? null,
              endDate: r.siteEndDate ?? null,
              company: r.companyId
                ? {
                    id: r.companyId,
                    name: r.companyName,
                    city: r.companyCity ?? null,
                    state: r.companyState ?? null,
                  }
                : null,
              parentCompany: r.parentCompanyId
                ? { id: r.parentCompanyId, name: r.parentCompanyName }
                : null,
              since: r.since,
            }
          : null,
      })),
      totalRecords: Number(countRows[0]?.total ?? 0),
    };
  }

  async getAllocationsBySiteId(siteId: string, onlyCurrentAllocations = false) {
    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: siteId } });

    const where: any = { siteId, deletedAt: IsNull() };
    if (onlyCurrentAllocations) {
      where.isCurrentlyAllocated = true;
    }

    return await this.siteAllocationRepository.findAll({
      where,
      relations: ['user'],
      order: { allocatedAt: 'DESC' },
    });
  }

  async getAllocationsByUserId(userId: string) {
    return await this.siteAllocationRepository.findAll({
      where: { userId, deletedAt: IsNull() },
      relations: ['site'],
      order: { allocatedAt: 'DESC' },
    });
  }

  private async validateAllocationType(allocationType: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_ALLOCATION_TYPES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(SITE_ALLOCATION_ERRORS.ALLOCATION_TYPES_CONFIG_NOT_FOUND);
    }

    const configSettings = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validTypes: { value: string; label: string }[] = [];
    for (const setting of configSettings.records) {
      if (Array.isArray(setting.value)) {
        validTypes.push(...setting.value);
      }
    }

    const validTypeValues = validTypes.map((t) => t.value.toLowerCase());

    if (!validTypeValues.includes(allocationType.toLowerCase())) {
      throw new BadRequestException(
        SITE_ALLOCATION_ERRORS.INVALID_ALLOCATION_TYPE.replace('{type}', allocationType).replace(
          '{available}',
          validTypes.map((t) => t.value).join(', '),
        ),
      );
    }
  }

  private async validateSiteRole(role: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_ROLES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(SITE_ALLOCATION_ERRORS.SITE_ROLES_CONFIG_NOT_FOUND);
    }

    const configSettings = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validRoles: { value: string; label: string }[] = [];
    for (const setting of configSettings.records) {
      if (Array.isArray(setting.value)) {
        validRoles.push(...setting.value);
      }
    }

    const validRoleValues = validRoles.map((r) => r.value.toLowerCase());

    if (!validRoleValues.includes(role.toLowerCase())) {
      throw new BadRequestException(
        SITE_ALLOCATION_ERRORS.INVALID_SITE_ROLE.replace('{role}', role).replace(
          '{available}',
          validRoles.map((r) => r.value).join(', '),
        ),
      );
    }
  }

  /**
   * Unified API for site allocation management
   * Handles both allocation and deallocation based on action
   */
  async manage(manageDto: ManageSiteAllocationDto, userId: string) {
    const { allocations = [], deallocations = [] } = manageDto;

    // Validate that at least one operation is requested
    if (!allocations.length && !deallocations.length) {
      throw new BadRequestException('At least one allocation or deallocation is required');
    }

    // Process deallocations FIRST, then allocations. This makes a "transfer" (release the
    // old site + allocate to the new site) work in a single request: releasing the current
    // allocation gives it an end date, so the subsequent create() sees a free range. Order still
    // matters because the two loops are independent (no shared transaction) and create() reads the
    // live state — and the clash check is now about dates, not a flag.
    const deallocationResults: {
      allocationId: string;
      success: boolean;
      message: string;
    }[] = [];

    for (const deallocation of deallocations) {
      try {
        const deallocateDto: DeallocateSiteDto = {
          deallocatedAt: deallocation.deallocatedAt,
          remarks: deallocation.remarks,
        };

        await this.deallocate(deallocation.allocationId, deallocateDto, userId);
        deallocationResults.push({
          allocationId: deallocation.allocationId,
          success: true,
          message: SITE_ALLOCATION_RESPONSES.DEALLOCATED,
        });
      } catch (error) {
        deallocationResults.push({
          allocationId: deallocation.allocationId,
          success: false,
          message: error.message || 'Failed to deallocate',
        });
      }
    }

    // Process allocations
    const allocationResults: {
      userId: string;
      siteId: string;
      success: boolean;
      message: string;
    }[] = [];

    for (const allocation of allocations) {
      try {
        const createDto: CreateSiteAllocationDto = {
          siteId: allocation.siteId,
          userId: allocation.userId,
          allocationType: allocation.allocationType,
          role: allocation.role,
          dailyAllowance: allocation.dailyAllowance,
          allocatedAt: allocation.allocatedAt,
          deallocatedAt: allocation.deallocatedAt,
          remarks: allocation.remarks,
        };

        await this.create(createDto, userId);
        allocationResults.push({
          userId: allocation.userId,
          siteId: allocation.siteId,
          success: true,
          message: SITE_ALLOCATION_RESPONSES.CREATED,
        });
      } catch (error) {
        allocationResults.push({
          userId: allocation.userId,
          siteId: allocation.siteId,
          success: false,
          message: error.message || 'Failed to allocate',
        });
      }
    }

    // Calculate summary counts
    const allocationSuccess = allocationResults.filter((r) => r.success).length;
    const allocationFailure = allocationResults.filter((r) => !r.success).length;
    const deallocationSuccess = deallocationResults.filter((r) => r.success).length;
    const deallocationFailure = deallocationResults.filter((r) => !r.success).length;

    return {
      message: `Operations completed - Allocations: ${allocationSuccess}/${allocations.length} succeeded, Deallocations: ${deallocationSuccess}/${deallocations.length} succeeded`,
      allocations: {
        totalRequested: allocations.length,
        successCount: allocationSuccess,
        failureCount: allocationFailure,
        results: allocationResults,
      },
      deallocations: {
        totalRequested: deallocations.length,
        successCount: deallocationSuccess,
        failureCount: deallocationFailure,
        results: deallocationResults,
      },
    };
  }
}
