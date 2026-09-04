import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource, In } from 'typeorm';
import { SITE_ACCESS_BYPASS_ROLES } from 'src/modules/common/financials/site-access.helper';
import { VendorRepository } from './vendor.repository';
import { VendorEntity } from './entities/vendor.entity';
import { CreateVendorDto, UpdateVendorDto, GetVendorDto } from './dto';
import {
  VENDOR_ERRORS,
  VENDOR_RESPONSES,
  VendorEntityFields,
  VendorType,
} from './constants/vendor.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import {
  getSiteStatsByVendorQuery,
  getFinancialStatsByVendorQuery,
  getOverallVendorStatsQuery,
  checkVendorHasSitesQuery,
  checkVendorHasPurchaseOrdersQuery,
} from './queries/vendor.queries';
import { VendorStats, OverallVendorStats } from './vendor.types';

@Injectable()
export class VendorService {
  constructor(
    private readonly vendorRepository: VendorRepository,
    private readonly utilityService: UtilityService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateVendorDto, createdBy: string) {
    this.validateGstByVendorType(createDto.vendorType, createDto.gstNumber);

    if (createDto.gstNumber) {
      const existingByGst = await this.findOne({
        where: { gstNumber: createDto.gstNumber, deletedAt: IsNull() },
      });
      if (existingByGst) {
        throw new ConflictException(VENDOR_ERRORS.GST_ALREADY_EXISTS);
      }
    }

    const fullAddress = this.buildFullAddress(createDto);
    const vendorCode = await this.generateVendorCode();

    const created = await this.vendorRepository.create({
      ...createDto,
      vendorCode,
      fullAddress,
      createdBy,
    });

    return {
      ...this.utilityService.getSuccessMessage(
        VendorEntityFields.VENDOR,
        DataSuccessOperationType.CREATE,
      ),
      id: created.id,
      vendorCode: created.vendorCode,
    };
  }

  /** FE preview of the code the next created vendor will receive. */
  async previewNextVendorCode(): Promise<{ vendorCode: string }> {
    return { vendorCode: await this.generateVendorCode() };
  }

  /**
   * Config-driven vendor code generator (e.g. VEN-0001).
   * Reads `vendor_code_config` ({ prefix, padLength }) and returns MAX(seq)+1
   * across ALL rows (incl. soft-deleted) sharing the prefix so codes never collide.
   */
  private async generateVendorCode(): Promise<string> {
    const cfgRows = await this.dataSource.query(
      `SELECT cs.value
         FROM config_settings cs
         JOIN configurations c ON c.id = cs."configId"
        WHERE c.key = 'vendor_code_config'
          AND cs."isActive" = true
          AND cs."deletedAt" IS NULL
        ORDER BY cs."createdAt" DESC
        LIMIT 1`,
    );
    // node-pg already parses jsonb → JS object; no JSON.parse needed.
    const cfg = (cfgRows?.[0]?.value ?? {}) as {
      prefix?: string;
      padLength?: number;
      startFrom?: number;
    };
    const prefix = cfg.prefix ?? 'VEN-';
    const padLength = Number(cfg.padLength ?? 4);
    const startFrom = Number(cfg.startFrom ?? 1);

    const rows = await this.dataSource.query(
      `SELECT COALESCE(MAX(CAST(substring("vendorCode" from '(\\d+)$') AS INTEGER)), 0) AS maxseq
         FROM vendors
        WHERE "vendorCode" LIKE $1`,
      [`${prefix}%`],
    );
    // `startFrom` is a floor, not a starting counter: it only bites while MAX is below it. Without
    // it an empty vendors table (fresh env, wiped QA DB) would restart at 1 and silently undo the
    // configured sequence start.
    const next = Math.max(Number(rows?.[0]?.maxseq ?? 0), startFrom - 1) + 1;
    return `${prefix}${String(next).padStart(padLength, '0')}`;
  }

  async findAll(options: GetVendorDto) {
    const {
      search,
      city,
      state,
      vendorType,
      isActive,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    const where: any = { deletedAt: IsNull() };

    if (search) where.name = ILike(`%${search}%`);
    if (city && city.length > 0) where.city = In(city);
    if (state && state.length > 0) where.state = In(state);
    if (vendorType) where.vendorType = vendorType;
    if (isActive !== undefined) where.isActive = isActive;

    const totalRecords = await this.vendorRepository.count({ where });

    const records = await this.vendorRepository.findAll({
      where,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const vendorIds = records.map((v) => v.id);

    const [statsMap, overallStats] = await Promise.all([
      this.getVendorStats(vendorIds),
      this.getOverallVendorStats(),
    ]);

    const transformedRecords = records.map((vendor) => ({
      ...vendor,
      stats: statsMap.get(vendor.id) || {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        totalPos: 0,
        totalPoAmount: 0,
        totalInvoicedAmount: 0,
        totalPaidAmount: 0,
      },
    }));

    return { records: transformedRecords, totalRecords, overallStats };
  }

  async findOne(options: FindOneOptions<VendorEntity>) {
    return await this.vendorRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<VendorEntity>): Promise<VendorEntity> {
    const vendor = await this.vendorRepository.findOne(options);
    if (!vendor) throw new NotFoundException(VENDOR_ERRORS.NOT_FOUND);
    return vendor;
  }

  async findById(id: string) {
    const vendor = await this.findOneOrFail({
      where: { id },
      relations: ['createdByUser', 'updatedByUser'],
    });

    return {
      ...vendor,
      createdByUser: vendor.createdByUser
        ? {
            id: vendor.createdByUser.id,
            employeeId: vendor.createdByUser.employeeId,
            firstName: vendor.createdByUser.firstName,
            lastName: vendor.createdByUser.lastName,
            email: vendor.createdByUser.email,
            profilePicture: vendor.createdByUser.profilePicture,
          }
        : null,
      updatedByUser: vendor.updatedByUser
        ? {
            id: vendor.updatedByUser.id,
            employeeId: vendor.updatedByUser.employeeId,
            firstName: vendor.updatedByUser.firstName,
            lastName: vendor.updatedByUser.lastName,
            email: vendor.updatedByUser.email,
            profilePicture: vendor.updatedByUser.profilePicture,
          }
        : null,
    };
  }

  /**
   * A vendor may only be edited or deleted by the user who created it.
   *
   * Office roles (SITE_ACCESS_BYPASS_ROLES) keep a full override so admins can still
   * correct or remove vendor data created by anyone. The restriction exists so a site
   * Project Manager, who can now create vendors, cannot alter another PM's vendors.
   *
   * Vendors created before this rule may have a null `createdBy`; those are treated as
   * not-owned, so only the bypass roles can modify them.
   */
  private assertCanModify(vendor: VendorEntity, actorId: string, activeRole?: string) {
    if (activeRole && SITE_ACCESS_BYPASS_ROLES.includes(activeRole.toUpperCase())) {
      return;
    }
    if (!vendor.createdBy || vendor.createdBy !== actorId) {
      throw new ForbiddenException(VENDOR_ERRORS.NOT_OWNER);
    }
  }

  async update(id: string, updateDto: UpdateVendorDto, updatedBy: string, activeRole?: string) {
    const existingVendor = await this.findOneOrFail({ where: { id } });
    this.assertCanModify(existingVendor, updatedBy, activeRole);

    const effectiveType = (updateDto.vendorType ?? existingVendor.vendorType) as VendorType;

    // When switching to FREELANCER and no gstNumber is provided in the payload,
    // auto-clear the existing gstNumber instead of carrying it forward and failing validation.
    const clearGst =
      updateDto.vendorType === VendorType.FREELANCER && updateDto.gstNumber === undefined;

    const effectiveGst = clearGst ? null : updateDto.gstNumber ?? existingVendor.gstNumber;
    this.validateGstByVendorType(effectiveType, effectiveGst);

    if (updateDto.gstNumber && updateDto.gstNumber !== existingVendor.gstNumber) {
      const gstConflict = await this.findOne({
        where: { gstNumber: updateDto.gstNumber, deletedAt: IsNull(), id: Not(id) },
      });
      if (gstConflict) throw new ConflictException(VENDOR_ERRORS.GST_ALREADY_EXISTS);
    }

    // existingVendor.vendorType is widened to `string` from the DB column,
    // but buildFullAddress only reads address fields — cast through `unknown`
    // to satisfy the TS structural check without loosening the helper's type.
    const fullAddress = this.buildFullAddress({
      ...(existingVendor as unknown as Partial<CreateVendorDto>),
      ...updateDto,
    });

    await this.vendorRepository.update({ id }, {
      ...updateDto,
      ...(clearGst ? { gstNumber: null } : {}),
      fullAddress,
      updatedBy,
    } as Partial<VendorEntity>);

    return this.utilityService.getSuccessMessage(
      VendorEntityFields.VENDOR,
      DataSuccessOperationType.UPDATE,
    );
  }

  async remove(id: string, deletedBy: string, activeRole?: string) {
    const vendor = await this.findOneOrFail({ where: { id } });
    this.assertCanModify(vendor, deletedBy, activeRole);
    await this.validateVendorCanBeDeleted(id);

    await this.vendorRepository.update({ id }, { deletedBy });
    await this.vendorRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      VendorEntityFields.VENDOR,
      DataSuccessOperationType.DELETE,
    );
  }

  /**
   * Validate that a vendor has no pending associations before delete.
   * Runs all checks in parallel; throws a single error listing every violation.
   */
  private async validateVendorCanBeDeleted(vendorId: string): Promise<void> {
    const checks = [
      {
        query: checkVendorHasSitesQuery,
        message: VENDOR_ERRORS.CANNOT_DELETE_HAS_SITES,
      },
      {
        query: checkVendorHasPurchaseOrdersQuery,
        message: VENDOR_ERRORS.VENDOR_HAS_PENDING_FINANCIALS,
      },
    ];

    const results = await Promise.all(
      checks.map(({ query }) => this.dataSource.query(query, [vendorId])),
    );

    const violations = checks.filter((_, i) => results[i].length > 0).map(({ message }) => message);

    if (violations.length > 0) {
      throw new BadRequestException(
        VENDOR_ERRORS.VENDOR_HAS_ACTIVE_ASSOCIATIONS.replace(
          '{issues}',
          violations.map((v, i) => `${i + 1}. ${v}`).join(' '),
        ),
      );
    }
  }

  async bulkDelete(vendorIds: string[], deletedBy: string, activeRole?: string) {
    const results: { id: string; success: boolean; message: string }[] = [];

    for (const vendorId of vendorIds) {
      try {
        const vendor = await this.vendorRepository.findOne({
          where: { id: vendorId, deletedAt: IsNull() },
        });

        if (!vendor) {
          results.push({ id: vendorId, success: false, message: VENDOR_ERRORS.NOT_FOUND });
          continue;
        }

        // Reported per row rather than aborting the batch, matching how
        // not-found and active-association failures are already handled.
        this.assertCanModify(vendor, deletedBy, activeRole);

        await this.validateVendorCanBeDeleted(vendorId);

        await this.vendorRepository.update({ id: vendorId }, { deletedBy });
        await this.vendorRepository.softDelete({ id: vendorId });

        results.push({ id: vendorId, success: true, message: VENDOR_RESPONSES.DELETED });
      } catch (error) {
        results.push({
          id: vendorId,
          success: false,
          message: error.message || VENDOR_ERRORS.DELETE_FAILED,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      message: VENDOR_RESPONSES.BULK_DELETE_COMPLETED(successCount, failureCount),
      totalRequested: vendorIds.length,
      successCount,
      failureCount,
      results,
    };
  }

  async restore(id: string) {
    const vendor = await this.vendorRepository.findOne({ where: { id }, withDeleted: true });
    if (!vendor) throw new NotFoundException(VENDOR_ERRORS.NOT_FOUND);

    await this.vendorRepository.restore({ id });
    await this.vendorRepository.update({ id }, { deletedBy: null, isActive: true });

    return { message: VENDOR_RESPONSES.RESTORED };
  }

  /**
   * Enforce BRD §2: vendor is either FREELANCER or GST_REGISTERED.
   * GST_REGISTERED requires a gstNumber; FREELANCER must NOT carry one.
   */
  private validateGstByVendorType(vendorType: VendorType | string, gstNumber?: string | null) {
    if (vendorType === VendorType.GST_REGISTERED && !gstNumber) {
      throw new BadRequestException(VENDOR_ERRORS.GST_REQUIRED_FOR_REGISTERED);
    }
    if (vendorType === VendorType.FREELANCER && gstNumber) {
      throw new BadRequestException(VENDOR_ERRORS.GST_NOT_ALLOWED_FOR_FREELANCER);
    }
  }

  private async getVendorStats(vendorIds: string[]): Promise<Map<string, VendorStats>> {
    const statsMap = new Map<string, VendorStats>();
    if (vendorIds.length === 0) return statsMap;

    const [siteStats, financialStats] = await Promise.all([
      this.dataSource.query(getSiteStatsByVendorQuery, [vendorIds]),
      this.dataSource.query(getFinancialStatsByVendorQuery, [vendorIds]).catch(() => []),
    ]);

    for (const id of vendorIds) {
      statsMap.set(id, {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        totalPos: 0,
        totalPoAmount: 0,
        totalInvoicedAmount: 0,
        totalPaidAmount: 0,
      });
    }

    for (const row of siteStats) {
      const stats = statsMap.get(row.vendorId);
      if (stats) {
        stats.totalSites = parseInt(row.totalSites) || 0;
        stats.activeSites = parseInt(row.activeSites) || 0;
        stats.upcomingSites = parseInt(row.upcomingSites) || 0;
        stats.completedSites = parseInt(row.completedSites) || 0;
        stats.holdSites = parseInt(row.holdSites) || 0;
      }
    }

    for (const row of financialStats) {
      const stats = statsMap.get(row.vendorId);
      if (stats) {
        stats.totalPos = parseInt(row.totalPos) || 0;
        stats.totalPoAmount = parseFloat(row.totalPoAmount) || 0;
        stats.totalInvoicedAmount = parseFloat(row.totalInvoicedAmount) || 0;
        stats.totalPaidAmount = parseFloat(row.totalPaidAmount) || 0;
      }
    }

    return statsMap;
  }

  private async getOverallVendorStats(): Promise<OverallVendorStats> {
    const result = await this.dataSource.query(getOverallVendorStatsQuery);
    const row = result[0] || {};
    return {
      totalVendors: parseInt(row.totalVendors) || 0,
      activeVendors: parseInt(row.activeVendors) || 0,
      inactiveVendors: parseInt(row.inactiveVendors) || 0,
      archivedVendors: parseInt(row.archivedVendors) || 0,
      freelancerVendors: parseInt(row.freelancerVendors) || 0,
      gstRegisteredVendors: parseInt(row.gstRegisteredVendors) || 0,
    };
  }

  private buildFullAddress(data: Partial<CreateVendorDto>): string {
    const addressParts: string[] = [];
    if (data.blockNumber) addressParts.push(data.blockNumber);
    if (data.buildingName) addressParts.push(data.buildingName);
    if (data.streetName) addressParts.push(data.streetName);
    if (data.landmark) addressParts.push(`Near ${data.landmark}`);
    if (data.area) addressParts.push(data.area);
    if (data.city) addressParts.push(data.city);
    if (data.state) addressParts.push(data.state);
    if (data.pincode) addressParts.push(`- ${data.pincode}`);
    if (data.country) addressParts.push(data.country);
    return addressParts.join(', ').replace(', - ', ' - ');
  }
}
