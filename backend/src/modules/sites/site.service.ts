import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource, In, Raw } from 'typeorm';
import { SiteRepository } from './site.repository';
import { SiteEntity } from './entities/site.entity';
import {
  CreateSiteDto,
  UpdateSiteDto,
  GetSiteDto,
  UpdateSiteStatusDto,
  GetSiteActivityDto,
} from './dto';
import {
  SITE_ERRORS,
  SITE_RESPONSES,
  SITE_STATUS_REASONS,
  SiteEntityFields,
  SiteStatus,
} from './constants/site.constants';
import { BillingService } from 'src/modules/billing/billing.service';
import { forwardRef, Inject } from '@nestjs/common';
import { SiteVendorService } from '../site-vendors/site-vendor.service';
import { SiteVendorEntity } from '../site-vendors/entities/site-vendor.entity';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import { CompanyService } from '../companies/company.service';
import { ContractorService } from '../contractors/contractor.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import {
  getSiteHealthScoresQuery,
  getOverallSiteStatsQuery,
  getAllocatedEmployeesBySitesQuery,
} from './queries/site.queries';
import { OverallSiteStats, AllocatedEmployee, SiteAllocationInfo } from './site.types';

@Injectable()
export class SiteService {
  constructor(
    private readonly siteRepository: SiteRepository,
    private readonly companyService: CompanyService,
    private readonly contractorService: ContractorService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly billingService: BillingService,
    @Inject(forwardRef(() => SiteVendorService))
    private readonly siteVendorService: SiteVendorService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateSiteDto, createdBy: string) {
    // Check for duplicate name
    const existingByName = await this.findOne({
      where: { name: ILike(createDto.name), deletedAt: IsNull() },
    });
    if (existingByName) {
      throw new ConflictException(SITE_ERRORS.NAME_ALREADY_EXISTS);
    }

    // Validate company exists
    await this.companyService.findOneOrFail({ where: { id: createDto.companyId } });

    // Validate all contractors exist
    await this.validateContractors(createDto.contractorIds);

    // Validate work types if provided
    if (createDto.workTypes && createDto.workTypes.length > 0) {
      await this.validateWorkTypes(createDto.workTypes);
    }

    // Validate date range
    if (createDto.endDate && new Date(createDto.endDate) < new Date(createDto.startDate)) {
      throw new BadRequestException(SITE_ERRORS.INVALID_DATE_RANGE);
    }

    const fullAddress = this.buildFullAddress(createDto);

    // Determine initial status based on dates
    const status = createDto.status || this.calculateStatus(createDto.startDate, createDto.endDate);

    return await this.dataSource.transaction(async (entityManager) => {
      // Create site
      const { contractorIds, vendorIds, startDate, endDate, ...siteData } = createDto;
      const site = await this.siteRepository.create(
        {
          ...siteData,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined,
          fullAddress,
          status,
          createdBy,
        },
        entityManager,
      );

      // Add contractors
      await this.siteRepository.addContractors(site.id, contractorIds, entityManager);

      // Add vendors if provided — inside same transaction
      if (vendorIds && vendorIds.length > 0) {
        const rows = vendorIds.map((vId) =>
          entityManager.getRepository(SiteVendorEntity).create({ siteId: site.id, vendorId: vId }),
        );
        await entityManager.getRepository(SiteVendorEntity).save(rows);
      }

      // Log initial status in history (fromStatus is null for new sites)
      await this.siteRepository.createStatusHistory(
        {
          siteId: site.id,
          fromStatus: null,
          toStatus: status,
          reason: SITE_STATUS_REASONS.SITE_CREATED,
          changedBy: createdBy,
          createdBy,
        },
        entityManager,
      );

      return this.utilityService.getSuccessMessage(
        SiteEntityFields.SITE,
        DataSuccessOperationType.CREATE,
      );
    });
  }

  async findAll(options: GetSiteDto, requestUserId?: string, activeRole?: string) {
    const {
      search,
      companyId,
      contractorId,
      managerName,
      status,
      city,
      state,
      isActive,
      siteTypes,
      includeContractors,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    const where: any = {
      deletedAt: IsNull(),
    };

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    // Multi-select filter for companyId
    if (companyId && companyId.length > 0) {
      where.companyId = In(companyId);
    }

    if (managerName) {
      where.managerName = ILike(`%${managerName}%`);
    }

    // Multi-select filter for status
    if (status && status.length > 0) {
      where.status = In(status);
    }

    // Multi-select filter for city
    if (city && city.length > 0) {
      where.city = In(city);
    }

    // Multi-select filter for state
    if (state && state.length > 0) {
      where.state = In(state);
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (siteTypes && siteTypes.length > 0) {
      // Use @> (contains) per value joined with OR — avoids ?| which conflicts with TypeORM param binding
      where.siteTypes = Raw((alias) =>
        siteTypes.map((t) => `${alias} @> '["${t.replace(/"/g, '\\"')}"]'::jsonb`).join(' OR '),
      );
    }

    // For EMPLOYEE role — restrict to sites they were ever allocated to
    const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'OPERATION_MANAGER', 'HR'];
    const isEmployee = activeRole && !ADMIN_ROLES.includes(activeRole.toUpperCase());
    if (isEmployee && requestUserId) {
      const allocatedSiteRows = await this.dataSource.query(
        `SELECT DISTINCT "siteId" FROM site_allocations WHERE "userId" = $1 AND "deletedAt" IS NULL`,
        [requestUserId],
      );
      const allocatedSiteIds = allocatedSiteRows.map((r: any) => r.siteId);
      if (allocatedSiteIds.length === 0) {
        // Employee has no allocations — return empty
        return this.utilityService.listResponse([], 0);
      }
      where.id = In(allocatedSiteIds);
    }

    const relations: string[] = ['company'];
    if (includeContractors) relations.push('siteContractors', 'siteContractors.contractor');

    let records = await this.siteRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Filter by contractor if specified (needs post-query filter due to junction table)
    // Supports multi-select: site must have at least one of the specified contractors
    if (contractorId && contractorId.length > 0) {
      records = records.filter((site) =>
        site.siteContractors?.some((sc) => contractorId.includes(sc.contractorId)),
      );
    }

    const totalRecords = await this.siteRepository.count({ where });

    // Fetch health scores and allocated employees for all sites in parallel
    const siteIds = records.map((site) => site.id);
    let healthScoreMap: Map<string, { healthScore: number; healthGrade: string }> = new Map();
    const allocationMap: Map<string, SiteAllocationInfo> = new Map();

    const vendorsBySite = new Map<string, any[]>();

    if (siteIds.length > 0) {
      const healthQuery = getSiteHealthScoresQuery(siteIds);
      const allocationQuery = getAllocatedEmployeesBySitesQuery(siteIds);
      const placeholders = siteIds.map((_, i) => `$${i + 1}`).join(',');

      const [healthResults, allocationResults, vendorResults] = await Promise.all([
        this.dataSource.query(healthQuery.query, healthQuery.params),
        this.dataSource.query(allocationQuery.query, allocationQuery.params),
        this.dataSource.query(
          `SELECT sv."siteId", v.id, v.name, v.email, v."contactNumber",
                  v."vendorType", v."gstNumber", v."isActive"
           FROM site_vendors sv
           JOIN vendors v ON v.id = sv."vendorId" AND v."deletedAt" IS NULL
           WHERE sv."siteId" IN (${placeholders})`,
          siteIds,
        ),
      ]);

      // Build vendors-by-site map
      for (const row of vendorResults) {
        const { siteId, ...vendor } = row;
        if (!vendorsBySite.has(siteId)) vendorsBySite.set(siteId, []);
        vendorsBySite.get(siteId)!.push(vendor);
      }

      // Build health score map
      healthScoreMap = new Map(
        healthResults.map((r: any) => [
          r.siteId,
          { healthScore: r.healthScore, healthGrade: r.healthGrade },
        ]),
      );

      // Build allocation map (group by siteId)
      const allocationBySite = new Map<string, AllocatedEmployee[]>();
      for (const row of allocationResults) {
        const siteId = row.siteId;
        if (!allocationBySite.has(siteId)) {
          allocationBySite.set(siteId, []);
        }
        allocationBySite.get(siteId)!.push({
          id: row.userId,
          allocationId: row.allocationId,
          employeeId: row.employeeId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          profilePicture: row.profilePicture,
          role: row.role,
          allocationType: row.allocationType,
          allocatedAt: row.allocatedAt,
        });
      }

      // Create allocation info map with count
      for (const siteId of siteIds) {
        const employees = allocationBySite.get(siteId) || [];
        allocationMap.set(siteId, {
          allocatedEmployeeCount: employees.length,
          allocatedEmployees: employees,
        });
      }
    }

    // Transform records: add health score, allocations, and limit relation fields
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const transformedRecords = records.map((site) => {
      const { company, siteContractors, ...siteData } = site;
      const allocation = allocationMap.get(site.id) || {
        allocatedEmployeeCount: 0,
        allocatedEmployees: [],
      };

      // Timeline metrics
      const start = new Date(site.startDate);
      start.setHours(0, 0, 0, 0);
      const daysElapsed = Math.max(0, Math.round((today.getTime() - start.getTime()) / MS_PER_DAY));
      const end = site.endDate ? new Date(site.endDate) : null;
      if (end) end.setHours(0, 0, 0, 0);
      const daysRemaining = end
        ? Math.max(0, Math.round((end.getTime() - today.getTime()) / MS_PER_DAY))
        : null;
      const totalDays = end
        ? Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
        : daysElapsed;
      const completionPercent =
        totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;

      return {
        ...siteData,
        // Health score
        healthScore: healthScoreMap.get(site.id)?.healthScore ?? null,
        healthGrade: healthScoreMap.get(site.id)?.healthGrade ?? null,
        // Timeline
        daysElapsed,
        daysRemaining,
        completionPercent,
        // Allocated employees
        allocatedEmployeeCount: allocation.allocatedEmployeeCount,
        allocatedEmployees: allocation.allocatedEmployees,
        // Company with limited fields
        ...(company && {
          company: {
            id: company.id,
            name: company.name,
            fullAddress: company.fullAddress,
            logo: company.logo,
          },
        }),
        // Site contractors with limited contractor fields
        ...(siteContractors && {
          siteContractors: siteContractors.map((sc) => ({
            id: sc.id,
            siteId: sc.siteId,
            contractorId: sc.contractorId,
            ...(sc.contractor && {
              contractor: {
                id: sc.contractor.id,
                name: sc.contractor.name,
                email: sc.contractor.email,
                contactNumber: sc.contractor.contactNumber,
                gstNumber: sc.contractor.gstNumber,
                fullAddress: sc.contractor.fullAddress,
                logo: sc.contractor.logo,
              },
            }),
          })),
        }),
        vendors: vendorsBySite.get(site.id) ?? [],
      };
    });

    // Get overall site stats
    const overallStats = await this.getOverallSiteStats();

    return {
      records: transformedRecords,
      totalRecords,
      stats: overallStats,
    };
  }

  /**
   * Get overall site statistics (aggregate counts by status)
   */
  private async getOverallSiteStats(): Promise<OverallSiteStats> {
    const result = await this.dataSource.query(getOverallSiteStatsQuery);
    const row = result[0] || {};

    return {
      totalSites: parseInt(row.totalSites) || 0,
      upcomingSites: parseInt(row.upcomingSites) || 0,
      ongoingSites: parseInt(row.ongoingSites) || 0,
      holdSites: parseInt(row.holdSites) || 0,
      workCompletedSites: parseInt(row.workCompletedSites) || 0,
      completedSites: parseInt(row.completedSites) || 0,
      activeSites: parseInt(row.activeSites) || 0,
      inactiveSites: parseInt(row.inactiveSites) || 0,
    };
  }

  async findOne(options: FindOneOptions<SiteEntity>) {
    return await this.siteRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<SiteEntity>): Promise<SiteEntity> {
    const site = await this.siteRepository.findOne(options);

    if (!site) {
      throw new NotFoundException(SITE_ERRORS.NOT_FOUND);
    }

    return site;
  }

  async findById(id: string, includeRelations = true) {
    const relations = includeRelations
      ? [
          'company',
          'siteContractors',
          'siteContractors.contractor',
          'createdByUser',
          'updatedByUser',
        ]
      : [];

    const [site, siteVendors] = await Promise.all([
      this.findOneOrFail({ where: { id }, relations }),
      includeRelations
        ? this.dataSource.query(
            `SELECT v.id, v.name, v.email, v."contactNumber", v."vendorType",
                    v."gstNumber", v."fullAddress", v.city, v.state, v."isActive"
             FROM site_vendors sv
             JOIN vendors v ON v.id = sv."vendorId" AND v."deletedAt" IS NULL
             WHERE sv."siteId" = $1`,
            [id],
          )
        : Promise.resolve([]),
    ]);

    // Transform response with limited relation fields
    const { company, siteContractors, createdByUser, updatedByUser, ...siteData } = site;

    return {
      ...siteData,
      ...(company && {
        company: {
          id: company.id,
          name: company.name,
          fullAddress: company.fullAddress,
          logo: company.logo,
        },
      }),
      ...(siteContractors && {
        siteContractors: siteContractors.map((sc) => ({
          id: sc.id,
          siteId: sc.siteId,
          contractorId: sc.contractorId,
          ...(sc.contractor && {
            contractor: {
              id: sc.contractor.id,
              name: sc.contractor.name,
              fullAddress: sc.contractor.fullAddress,
              logo: sc.contractor.logo,
            },
          }),
        })),
      }),
      vendors: siteVendors,
      ...(createdByUser && {
        createdByUser: {
          id: createdByUser.id,
          employeeId: createdByUser.employeeId,
          firstName: createdByUser.firstName,
          lastName: createdByUser.lastName,
          email: createdByUser.email,
          profilePicture: createdByUser.profilePicture,
        },
      }),
      ...(updatedByUser && {
        updatedByUser: {
          id: updatedByUser.id,
          employeeId: updatedByUser.employeeId,
          firstName: updatedByUser.firstName,
          lastName: updatedByUser.lastName,
          email: updatedByUser.email,
          profilePicture: updatedByUser.profilePicture,
        },
      }),
    };
  }

  async update(id: string, updateDto: UpdateSiteDto, updatedBy: string) {
    const existingSite = await this.findOneOrFail({ where: { id } });

    // Check for duplicate name (excluding current)
    if (updateDto.name && updateDto.name !== existingSite.name) {
      const nameConflict = await this.findOne({
        where: { name: ILike(updateDto.name), deletedAt: IsNull(), id: Not(id) },
      });
      if (nameConflict) {
        throw new ConflictException(SITE_ERRORS.NAME_ALREADY_EXISTS);
      }
    }

    // Validate company if changed
    if (updateDto.companyId && updateDto.companyId !== existingSite.companyId) {
      await this.companyService.findOneOrFail({ where: { id: updateDto.companyId } });
    }

    // Validate contractors if provided
    if (updateDto.contractorIds) {
      await this.validateContractors(updateDto.contractorIds);
    }

    // Validate work types if provided
    if (updateDto.workTypes && updateDto.workTypes.length > 0) {
      await this.validateWorkTypes(updateDto.workTypes);
    }

    // Validate date range
    const startDate = updateDto.startDate || existingSite.startDate;
    const endDate = updateDto.endDate !== undefined ? updateDto.endDate : existingSite.endDate;
    if (endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException(SITE_ERRORS.INVALID_DATE_RANGE);
    }

    // Auto-recalculate status when dates change and no explicit status override is provided.
    // Skip if site is on HOLD (user deliberately paused it) or if the caller is explicitly
    // setting a status in this same request.
    const datesChanged = updateDto.startDate !== undefined || updateDto.endDate !== undefined;
    const currentStatus = existingSite.status as SiteStatus;
    if (datesChanged && !updateDto.status && currentStatus !== SiteStatus.HOLD) {
      updateDto.status = this.calculateStatus(startDate, endDate);
    }

    const fullAddress = this.buildFullAddress({
      ...existingSite,
      ...updateDto,
    });

    return await this.dataSource.transaction(async (entityManager) => {
      // Update site
      const {
        contractorIds,
        vendorIds,
        startDate: startDateStr,
        endDate: endDateStr,
        ...dtoData
      } = updateDto;
      const updateData: Partial<SiteEntity> = {
        ...dtoData,
        fullAddress,
        updatedBy,
      };

      if (startDateStr) {
        updateData.startDate = new Date(startDateStr);
      }
      if (endDateStr !== undefined) {
        updateData.endDate = endDateStr ? new Date(endDateStr) : null;
      }

      await this.siteRepository.update({ id }, updateData, entityManager);

      // Update contractors if provided
      if (updateDto.contractorIds) {
        // Find which contractors are being removed and block if they have POs on this site
        const currentContractors = await this.siteRepository.getContractorsBySiteId(
          id,
          entityManager,
        );
        const currentContractorIds = currentContractors.map((sc) => sc.contractorId);
        const removedContractorIds = currentContractorIds.filter(
          (cId) => !contractorIds.includes(cId),
        );
        if (removedContractorIds.length > 0) {
          const result = await entityManager.query(
            `SELECT 1 FROM purchase_orders WHERE "siteId" = $1 AND "contractorId" = ANY($2::uuid[]) AND "deletedAt" IS NULL LIMIT 1`,
            [id, removedContractorIds],
          );
          if (result.length > 0) {
            throw new BadRequestException(SITE_ERRORS.CONTRACTOR_HAS_FINANCIAL_DOCS);
          }
        }
        await this.siteRepository.removeContractors(id, undefined, entityManager);
        await this.siteRepository.addContractors(id, contractorIds, entityManager);
      }

      // Update vendors if provided — remove all, then re-add
      if (vendorIds !== undefined) {
        // Find which vendors are being removed and block if they have POs on this site
        const currentSiteVendors = await entityManager
          .getRepository(SiteVendorEntity)
          .find({ where: { siteId: id } });
        const currentVendorIds = currentSiteVendors.map((sv) => sv.vendorId);
        const removedVendorIds = currentVendorIds.filter((vId) => !vendorIds.includes(vId));
        if (removedVendorIds.length > 0) {
          const result = await entityManager.query(
            `SELECT 1 FROM purchase_orders WHERE "siteId" = $1 AND "vendorId" = ANY($2::uuid[]) AND "deletedAt" IS NULL LIMIT 1`,
            [id, removedVendorIds],
          );
          if (result.length > 0) {
            throw new BadRequestException(SITE_ERRORS.VENDOR_HAS_FINANCIAL_DOCS);
          }
        }
        await entityManager.getRepository(SiteVendorEntity).delete({ siteId: id });
        if (vendorIds.length > 0) {
          const rows = vendorIds.map((vId) =>
            entityManager.getRepository(SiteVendorEntity).create({ siteId: id, vendorId: vId }),
          );
          await entityManager.getRepository(SiteVendorEntity).save(rows);
        }
      }

      return this.utilityService.getSuccessMessage(
        SiteEntityFields.SITE,
        DataSuccessOperationType.UPDATE,
      );
    });
  }

  async updateStatus(id: string, updateStatusDto: UpdateSiteStatusDto, updatedBy: string) {
    const site = await this.findOneOrFail({ where: { id } });

    // Validate status transition
    this.validateStatusTransition(site.status, updateStatusDto.status);

    // If transitioning to ONGOING, start date must have arrived
    if (updateStatusDto.status === SiteStatus.ONGOING) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = site.startDate ? new Date(site.startDate) : null;
      if (!startDate || startDate > today) {
        throw new BadRequestException(SITE_ERRORS.ONGOING_REQUIRES_STARTED);
      }
    }

    // If transitioning to COMPLETED, end date must have already passed
    if (updateStatusDto.status === SiteStatus.COMPLETED) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = site.endDate ? new Date(site.endDate) : null;
      if (!endDate || endDate > today) {
        throw new BadRequestException(SITE_ERRORS.COMPLETED_REQUIRES_PAST_END_DATE);
      }
    }

    // Block status change to HOLD / WORK_COMPLETED / COMPLETED if employees are still allocated
    const restrictedStatuses = [SiteStatus.HOLD, SiteStatus.WORK_COMPLETED, SiteStatus.COMPLETED];
    if (restrictedStatuses.includes(updateStatusDto.status as SiteStatus)) {
      const activeAllocations = await this.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM site_allocations WHERE "siteId" = $1 AND "isCurrentlyAllocated" = true AND "deletedAt" IS NULL`,
        [id],
      );
      const activeCount = activeAllocations[0]?.count ?? 0;
      if (activeCount > 0) {
        throw new BadRequestException(
          SITE_ERRORS.ACTIVE_ALLOCATIONS_EXIST.replace('{status}', updateStatusDto.status).replace(
            '{count}',
            String(activeCount),
          ),
        );
      }
    }

    // If transitioning to COMPLETED, check financial clearance (BRD §9)
    if (updateStatusDto.status === SiteStatus.COMPLETED) {
      const readiness = await this.billingService.getSiteClosingReadiness({ siteId: id });
      if (!readiness.canClose) {
        const failedConditions = readiness.conditions
          .filter((c) => !c.pass)
          .map((c) => `${c.id}: ${c.detail.join(', ') || 'not met'}`)
          .join('; ');
        throw new BadRequestException(
          `${SITE_ERRORS.SITE_NOT_READY_FOR_CLOSING} Failed conditions: ${failedConditions}`,
        );
      }
    }

    return await this.dataSource.transaction(async (entityManager) => {
      // Update site status
      await this.siteRepository.update(
        { id },
        {
          status: updateStatusDto.status,
          updatedBy,
        },
        entityManager,
      );

      // Log status change in history
      await this.siteRepository.createStatusHistory(
        {
          siteId: id,
          fromStatus: site.status,
          toStatus: updateStatusDto.status,
          reason: updateStatusDto.reason || null,
          changedBy: updatedBy,
          createdBy: updatedBy,
        },
        entityManager,
      );

      return { message: SITE_RESPONSES.STATUS_UPDATED };
    });
  }

  async remove(id: string, deletedBy: string) {
    const site = await this.findOneOrFail({ where: { id } });

    // Prevent deletion of active/ongoing sites
    if (site.status === SiteStatus.ONGOING) {
      throw new BadRequestException(SITE_ERRORS.CANNOT_DELETE_ACTIVE_SITE);
    }

    // Prevent deletion if any associated data exists
    const blockers = await this.checkAssociatedData(id);
    if (blockers.length > 0) {
      throw new BadRequestException(
        SITE_ERRORS.CANNOT_DELETE_SITE_HAS_DATA.replace('{tables}', blockers.join(', ')),
      );
    }

    await this.siteRepository.update({ id }, { deletedBy });
    await this.siteRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      SiteEntityFields.SITE,
      DataSuccessOperationType.DELETE,
    );
  }

  async bulkDelete(siteIds: string[], deletedBy: string) {
    const results: { id: string; success: boolean; message: string }[] = [];

    for (const siteId of siteIds) {
      try {
        // Check if site exists
        const site = await this.siteRepository.findOne({
          where: { id: siteId, deletedAt: IsNull() },
        });

        if (!site) {
          results.push({
            id: siteId,
            success: false,
            message: SITE_ERRORS.NOT_FOUND,
          });
          continue;
        }

        // Prevent deletion of active/ongoing sites
        if (site.status === SiteStatus.ONGOING) {
          results.push({
            id: siteId,
            success: false,
            message: SITE_ERRORS.CANNOT_DELETE_ACTIVE_SITE,
          });
          continue;
        }

        // Prevent deletion if any associated data exists
        const blockers = await this.checkAssociatedData(siteId);
        if (blockers.length > 0) {
          results.push({
            id: siteId,
            success: false,
            message: SITE_ERRORS.CANNOT_DELETE_SITE_HAS_DATA.replace(
              '{tables}',
              blockers.join(', '),
            ),
          });
          continue;
        }

        // Perform soft delete
        await this.siteRepository.update({ id: siteId }, { deletedBy });
        await this.siteRepository.softDelete({ id: siteId });

        results.push({
          id: siteId,
          success: true,
          message: SITE_RESPONSES.DELETED,
        });
      } catch (error) {
        results.push({
          id: siteId,
          success: false,
          message: error.message || 'Failed to delete site',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      message: `Bulk delete completed: ${successCount} succeeded, ${failureCount} failed`,
      totalRequested: siteIds.length,
      successCount,
      failureCount,
      results,
    };
  }

  async restore(id: string) {
    const site = await this.siteRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!site) {
      throw new NotFoundException(SITE_ERRORS.NOT_FOUND);
    }

    await this.siteRepository.restore({ id });
    await this.siteRepository.update({ id }, { deletedBy: null });

    const restoredSite = await this.findById(id);
    return {
      message: SITE_RESPONSES.RESTORED,
      data: restoredSite,
    };
  }

  async getContractors(siteId: string) {
    await this.findOneOrFail({ where: { id: siteId } });
    return await this.siteRepository.getContractorsBySiteId(siteId);
  }

  async getOverview(siteId: string) {
    const site = await this.siteRepository.findOne({
      where: { id: siteId, deletedAt: IsNull() },
      relations: ['company'],
    });
    if (!site) throw new NotFoundException(SITE_ERRORS.NOT_FOUND);

    const [allocations, contractors, vendors] = await Promise.all([
      // All employee allocations (both current and past)
      this.dataSource.query(
        `SELECT
           sa.id, sa."userId", sa."allocationType", sa.role,
           sa."dailyAllowance", sa."allocatedAt", sa."deallocatedAt",
           sa."isCurrentlyAllocated", sa.remarks,
           u."firstName", u."lastName", u.email, u."employeeId", u."profilePicture"
         FROM site_allocations sa
         JOIN users u ON u.id = sa."userId"
         WHERE sa."siteId" = $1 AND sa."deletedAt" IS NULL
         ORDER BY sa."allocatedAt" DESC`,
        [siteId],
      ),
      // Contractors linked to site
      this.dataSource.query(
        `SELECT c.id, c.name, c.email, c."contactNumber", c."gstNumber",
                c."fullAddress", c.city, c.state, c."isActive"
         FROM site_contractors sc
         JOIN contractors c ON c.id = sc."contractorId" AND c."deletedAt" IS NULL
         WHERE sc."siteId" = $1`,
        [siteId],
      ),
      // Vendors linked to site
      this.dataSource.query(
        `SELECT v.id, v.name, v.email, v."contactNumber", v."vendorType",
                v."gstNumber", v."fullAddress", v.city, v.state, v."isActive"
         FROM site_vendors sv
         JOIN vendors v ON v.id = sv."vendorId" AND v."deletedAt" IS NULL
         WHERE sv."siteId" = $1`,
        [siteId],
      ),
    ]);

    const formatEmployee = (row: any) => ({
      allocationId: row.id,
      userId: row.userId,
      employeeId: row.employeeId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      profilePicture: row.profilePicture,
      role: row.role,
      allocationType: row.allocationType,
      dailyAllowance: row.dailyAllowance ? Number(row.dailyAllowance) : null,
      allocatedAt: row.allocatedAt,
      deallocatedAt: row.deallocatedAt,
      remarks: row.remarks,
    });

    return {
      site: {
        id: site.id,
        name: site.name,
        status: site.status,
        startDate: site.startDate,
        endDate: site.endDate,
        managerName: site.managerName,
        managerContact: site.managerContact,
        workTypes: site.workTypes ?? [],
        fullAddress: site.fullAddress,
        city: site.city,
        state: site.state,
        pincode: site.pincode,
        estimatedBudget: site.estimatedBudget ? Number(site.estimatedBudget) : null,
        siteTypes: site.siteTypes ?? [],
        isActive: site.isActive,
        company: site.company ? { id: site.company.id, name: site.company.name } : null,
      },
      employees: {
        allocated: allocations.filter((r: any) => r.isCurrentlyAllocated).map(formatEmployee),
        deallocated: allocations.filter((r: any) => !r.isCurrentlyAllocated).map(formatEmployee),
      },
      contractors,
      vendors,
    };
  }

  /**
   * GET /sites/activity — general cross-site report.
   * Returns site details + contractors + vendors + full employee allocation history.
   * Filterable by site name, siteId[], companyId[], contractorId[], vendorId[], employeeName.
   */
  async getSiteActivity(options: GetSiteActivityDto) {
    const {
      search,
      siteId,
      companyId,
      contractorId,
      vendorId,
      siteTypes,
      employeeName,
      sortField = 'createdAt',
      sortOrder = 'DESC',
      page = 1,
      pageSize = 10,
    } = options;

    // --- Build dynamic WHERE + JOIN for filtering ---
    const conditions: string[] = [`s."deletedAt" IS NULL`];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.name ILIKE $${params.length}`);
    }

    if (siteId && siteId.length > 0) {
      params.push(siteId);
      conditions.push(`s.id = ANY($${params.length})`);
    }

    if (companyId && companyId.length > 0) {
      params.push(companyId);
      conditions.push(`s."companyId" = ANY($${params.length})`);
    }

    if (siteTypes && siteTypes.length > 0) {
      params.push(siteTypes);
      conditions.push(`s."siteTypes" ?| $${params.length}::text[]`);
    }

    // Extra JOINs (INNER) — only applied when the corresponding filter is active
    const extraJoins: string[] = [];

    if (contractorId && contractorId.length > 0) {
      extraJoins.push(
        `JOIN site_contractors sc_f ON sc_f."siteId" = s.id` +
          ` JOIN contractors c_f ON c_f.id = sc_f."contractorId" AND c_f."deletedAt" IS NULL`,
      );
      params.push(contractorId);
      conditions.push(`c_f.id = ANY($${params.length})`);
    }

    if (vendorId && vendorId.length > 0) {
      extraJoins.push(
        `JOIN site_vendors sv_f ON sv_f."siteId" = s.id` +
          ` JOIN vendors v_f ON v_f.id = sv_f."vendorId" AND v_f."deletedAt" IS NULL`,
      );
      params.push(vendorId);
      conditions.push(`v_f.id = ANY($${params.length})`);
    }

    if (employeeName) {
      extraJoins.push(
        `JOIN site_allocations sa_f ON sa_f."siteId" = s.id AND sa_f."deletedAt" IS NULL` +
          ` JOIN users u_f ON u_f.id = sa_f."userId" AND u_f."deletedAt" IS NULL`,
      );
      params.push(`%${employeeName}%`);
      const p = params.length;
      conditions.push(
        `(u_f."firstName" ILIKE $${p} OR u_f."lastName" ILIKE $${p} OR (u_f."firstName" || ' ' || u_f."lastName") ILIKE $${p})`,
      );
    }

    const whereClause = conditions.join(' AND ');
    const extraJoinSql = extraJoins.join('\n');

    // Allowed sort columns (whitelist to prevent SQL injection)
    const sortColMap: Record<string, string> = {
      createdAt: 's."createdAt"',
      name: 's.name',
      status: 's.status',
      startDate: 's."startDate"',
      endDate: 's."endDate"',
    };
    const orderCol = sortColMap[sortField] ?? 's."createdAt"';
    const orderDir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // --- Count ---
    const countResult = await this.dataSource.query(
      `SELECT COUNT(DISTINCT s.id) AS count FROM sites s ${extraJoinSql} WHERE ${whereClause}`,
      params,
    );
    const totalRecords = parseInt(countResult[0]?.count ?? '0') || 0;

    if (totalRecords === 0) {
      return { records: [], totalRecords };
    }

    // --- Paginated site IDs (ordered) ---
    const idRows: { id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT s.id, ${orderCol} AS _sort
       FROM sites s ${extraJoinSql}
       WHERE ${whereClause}
       ORDER BY _sort ${orderDir}, s.id ${orderDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    if (idRows.length === 0) {
      return { records: [], totalRecords };
    }

    const orderedIds = idRows.map((r) => r.id);
    const ph = orderedIds.map((_, i) => `$${i + 1}`).join(', ');

    // --- Fetch all detail data in one parallel round-trip ---
    const [siteRows, contractorRows, vendorRows, allocationRows] = await Promise.all([
      this.dataSource.query(
        `SELECT
           s.id, s.name, s.status, s."startDate", s."endDate", s.city, s.state,
           s.pincode, s."fullAddress", s."managerName", s."managerContact",
           s."workTypes", s."isActive", s."estimatedBudget", s."siteTypes", s."createdAt", s."updatedAt",
           comp.id AS "companyId", comp.name AS "companyName",
           comp."fullAddress" AS "companyFullAddress", comp.logo AS "companyLogo"
         FROM sites s
         LEFT JOIN companies comp ON comp.id = s."companyId"
         WHERE s.id IN (${ph})`,
        orderedIds,
      ),
      this.dataSource.query(
        `SELECT sc."siteId", c.id, c.name, c.email, c."contactNumber",
                c."gstNumber", c."fullAddress", c."isActive"
         FROM site_contractors sc
         JOIN contractors c ON c.id = sc."contractorId" AND c."deletedAt" IS NULL
         WHERE sc."siteId" IN (${ph})`,
        orderedIds,
      ),
      this.dataSource.query(
        `SELECT sv."siteId", v.id, v.name, v.email, v."contactNumber",
                v."vendorType", v."gstNumber", v."fullAddress", v."isActive"
         FROM site_vendors sv
         JOIN vendors v ON v.id = sv."vendorId" AND v."deletedAt" IS NULL
         WHERE sv."siteId" IN (${ph})`,
        orderedIds,
      ),
      this.dataSource.query(
        `SELECT
           sa.id AS "allocationId", sa."siteId", sa."userId",
           sa.role, sa."allocationType", sa."dailyAllowance",
           sa."allocatedAt", sa."deallocatedAt", sa."isCurrentlyAllocated", sa.remarks,
           u."firstName", u."lastName", u.email, u."employeeId", u."profilePicture"
         FROM site_allocations sa
         JOIN users u ON u.id = sa."userId" AND u."deletedAt" IS NULL
         WHERE sa."siteId" IN (${ph}) AND sa."deletedAt" IS NULL
         ORDER BY sa."siteId", u."lastName", u."firstName", sa."allocatedAt" DESC`,
        orderedIds,
      ),
    ]);

    // --- Build lookup maps ---
    const siteMap = new Map<string, any>();
    for (const row of siteRows) siteMap.set(row.id, row);

    const contractorsBySite = new Map<string, any[]>();
    for (const row of contractorRows) {
      const { siteId: sid, ...c } = row;
      if (!contractorsBySite.has(sid)) contractorsBySite.set(sid, []);
      contractorsBySite.get(sid)!.push(c);
    }

    const vendorsBySite = new Map<string, any[]>();
    for (const row of vendorRows) {
      const { siteId: sid, ...v } = row;
      if (!vendorsBySite.has(sid)) vendorsBySite.set(sid, []);
      vendorsBySite.get(sid)!.push(v);
    }

    // Group allocation rows by site → user (each user may have multiple history rows)
    const allocationsBySite = new Map<string, Map<string, any>>();
    for (const row of allocationRows) {
      const {
        siteId: sid,
        userId,
        allocationId,
        role,
        allocationType,
        dailyAllowance,
        allocatedAt,
        deallocatedAt,
        isCurrentlyAllocated,
        remarks,
        firstName,
        lastName,
        email,
        employeeId,
        profilePicture,
      } = row;

      if (!allocationsBySite.has(sid)) allocationsBySite.set(sid, new Map());
      const userMap = allocationsBySite.get(sid)!;

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          employeeId,
          firstName,
          lastName,
          email,
          profilePicture,
          history: [],
        });
      }

      userMap.get(userId)!.history.push({
        allocationId,
        role,
        allocationType,
        dailyAllowance: dailyAllowance != null ? Number(dailyAllowance) : 0,
        allocatedAt,
        deallocatedAt,
        isCurrentlyAllocated,
        remarks: remarks ?? null,
      });
    }

    // --- Assemble final records in original (paginated) order ---
    const records = orderedIds
      .map((sid) => {
        const site = siteMap.get(sid);
        if (!site) return null;

        const { companyId: cId, companyName, companyFullAddress, companyLogo, ...siteData } = site;

        return {
          ...siteData,
          company: cId
            ? { id: cId, name: companyName, fullAddress: companyFullAddress, logo: companyLogo }
            : null,
          contractors: contractorsBySite.get(sid) ?? [],
          vendors: vendorsBySite.get(sid) ?? [],
          employeeAllocations: allocationsBySite.has(sid)
            ? Array.from(allocationsBySite.get(sid)!.values())
            : [],
        };
      })
      .filter(Boolean);

    return { records, totalRecords };
  }

  /**
   * Get status history timeline for a site
   */
  async getStatusHistory(siteId: string) {
    await this.findOneOrFail({ where: { id: siteId } });
    const history = await this.siteRepository.getStatusHistory(siteId);
    return {
      message: SITE_RESPONSES.STATUS_HISTORY_FETCHED,
      data: history,
    };
  }

  private async validateContractors(contractorIds: string[]): Promise<void> {
    for (const contractorId of contractorIds) {
      const contractor = await this.contractorService.findOne({
        where: { id: contractorId, deletedAt: IsNull() },
      });
      if (!contractor) {
        throw new NotFoundException(SITE_ERRORS.CONTRACTOR_NOT_FOUND);
      }
    }
  }

  private calculateStatus(startDate: string | Date, endDate?: string | Date | null): SiteStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    if (start > today) {
      return SiteStatus.UPCOMING;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      if (end < today) {
        return SiteStatus.COMPLETED;
      }
    }

    return SiteStatus.ONGOING;
  }

  private validateStatusTransition(currentStatus: SiteStatus, newStatus: SiteStatus): void {
    // Define valid transitions
    const validTransitions: Record<SiteStatus, SiteStatus[]> = {
      [SiteStatus.UPCOMING]: [SiteStatus.ONGOING, SiteStatus.HOLD, SiteStatus.WORK_COMPLETED],
      [SiteStatus.ONGOING]: [SiteStatus.HOLD, SiteStatus.WORK_COMPLETED],
      [SiteStatus.HOLD]: [SiteStatus.ONGOING, SiteStatus.WORK_COMPLETED, SiteStatus.COMPLETED],
      [SiteStatus.WORK_COMPLETED]: [SiteStatus.COMPLETED, SiteStatus.ONGOING, SiteStatus.HOLD],
      [SiteStatus.COMPLETED]: [SiteStatus.HOLD, SiteStatus.WORK_COMPLETED],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        SITE_ERRORS.INVALID_STATUS_TRANSITION.replace('{from}', currentStatus).replace(
          '{to}',
          newStatus,
        ),
      );
    }
  }

  /**
   * Check if any associated data exists for a site across all dependent tables.
   * Returns a list of human-readable table labels that have data, or empty array if safe to delete.
   */
  private async checkAssociatedData(siteId: string): Promise<string[]> {
    const checks: { label: string; table: string; hasSoftDelete: boolean }[] = [
      { label: 'Purchase Orders', table: 'purchase_orders', hasSoftDelete: true },
      { label: 'JMCs', table: 'jmcs', hasSoftDelete: true },
      { label: 'Site Reports', table: 'site_reports', hasSoftDelete: true },
      { label: 'Invoices', table: 'site_invoices', hasSoftDelete: true },
      { label: 'Book Payments', table: 'book_payments', hasSoftDelete: true },
      { label: 'Bank Transfers', table: 'bank_transfers', hasSoftDelete: true },
      { label: 'Debit Notes', table: 'debit_notes', hasSoftDelete: true },
      { label: 'Credit Notes', table: 'credit_notes', hasSoftDelete: true },
      { label: 'GST Register', table: 'gst_register_entries', hasSoftDelete: false },
      { label: 'TDS Register', table: 'tds_register_entries', hasSoftDelete: false },
      { label: 'Site Documents', table: 'site_documents', hasSoftDelete: true },
      { label: 'Vehicle Logs', table: 'vehicle_logs', hasSoftDelete: true },
      { label: 'Daily Status Reports', table: 'daily_status_reports', hasSoftDelete: true },
      { label: 'Employee Allocations', table: 'site_allocations', hasSoftDelete: true },
    ];

    // Build a single UNION ALL query — returns first matching row per table (EXISTS is fastest)
    const unionParts = checks.map(({ label, table, hasSoftDelete }) => {
      const softDeleteClause = hasSoftDelete ? ` AND "deletedAt" IS NULL` : '';
      return `SELECT '${label}' AS lbl WHERE EXISTS (SELECT 1 FROM ${table} WHERE "siteId" = '${siteId}'${softDeleteClause})`;
    });

    const rows: { lbl: string }[] = await this.dataSource.query(unionParts.join('\nUNION ALL\n'));
    return rows.map((r) => r.lbl);
  }

  private buildFullAddress(data: {
    blockNumber?: string;
    buildingName?: string;
    streetName?: string;
    landmark?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  }): string {
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

  private async validateWorkTypes(workTypes: string[]): Promise<void> {
    // Get the configuration for work types
    const workTypesConfig = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_WORK_TYPES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!workTypesConfig) {
      throw new BadRequestException(SITE_ERRORS.WORK_TYPES_CONFIG_NOT_FOUND);
    }

    // Get all valid work types from config_settings for this configuration
    const configSettingsResult = await this.configSettingService.findAll({
      where: { configId: workTypesConfig.id, isActive: true },
    });

    // The value is stored as a JSON array of work type objects
    // Format: [{ value: 'Testing', label: 'Testing' }, ...]
    const validWorkTypesArray: { value: string; label: string }[] = [];
    for (const setting of configSettingsResult.records) {
      if (Array.isArray(setting.value)) {
        validWorkTypesArray.push(...setting.value);
      }
    }

    // Extract valid work type values (case-insensitive comparison)
    const validWorkTypeValues = validWorkTypesArray.map((wt) => wt.value.toLowerCase());

    // Check each provided work type
    for (const workType of workTypes) {
      if (!validWorkTypeValues.includes(workType.toLowerCase())) {
        throw new BadRequestException(
          SITE_ERRORS.INVALID_WORK_TYPE.replace('{workType}', workType).replace(
            '{available}',
            validWorkTypesArray.map((wt) => wt.value).join(', '),
          ),
        );
      }
    }
  }
}
