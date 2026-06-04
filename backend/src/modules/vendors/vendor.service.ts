import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource, In } from 'typeorm';
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

    await this.vendorRepository.create({
      ...createDto,
      fullAddress,
      createdBy,
    });

    return this.utilityService.getSuccessMessage(
      VendorEntityFields.VENDOR,
      DataSuccessOperationType.CREATE,
    );
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

  async update(id: string, updateDto: UpdateVendorDto, updatedBy: string) {
    const existingVendor = await this.findOneOrFail({ where: { id } });

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

  async remove(id: string, deletedBy: string) {
    await this.findOneOrFail({ where: { id } });
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

  async bulkDelete(vendorIds: string[], deletedBy: string) {
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
