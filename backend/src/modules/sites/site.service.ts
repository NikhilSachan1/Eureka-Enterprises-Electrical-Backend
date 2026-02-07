import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource, In } from 'typeorm';
import { SiteRepository } from './site.repository';
import { SiteEntity } from './entities/site.entity';
import { CreateSiteDto, UpdateSiteDto, GetSiteDto, UpdateSiteStatusDto } from './dto';
import {
  SITE_ERRORS,
  SITE_RESPONSES,
  SITE_STATUS_REASONS,
  SiteEntityFields,
  SiteStatus,
} from './constants/site.constants';
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
      const { contractorIds, startDate, endDate, ...siteData } = createDto;
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

  async findAll(options: GetSiteDto) {
    const {
      search,
      companyId,
      contractorId,
      managerName,
      status,
      city,
      state,
      isActive,
      includeContractors,
      includeCompany,
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

    const relations: string[] = [];
    if (includeCompany) relations.push('company');
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

    if (siteIds.length > 0) {
      const healthQuery = getSiteHealthScoresQuery(siteIds);
      const allocationQuery = getAllocatedEmployeesBySitesQuery(siteIds);

      const [healthResults, allocationResults] = await Promise.all([
        this.dataSource.query(healthQuery.query, healthQuery.params),
        this.dataSource.query(allocationQuery.query, allocationQuery.params),
      ]);

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
          employeeId: row.employeeId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          profilePicture: row.profilePicture,
          role: row.role,
          allocationType: row.allocationType,
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
    const transformedRecords = records.map((site) => {
      const { company, siteContractors, ...siteData } = site;
      const allocation = allocationMap.get(site.id) || {
        allocatedEmployeeCount: 0,
        allocatedEmployees: [],
      };

      return {
        ...siteData,
        // Health score
        healthScore: healthScoreMap.get(site.id)?.healthScore ?? null,
        healthGrade: healthScoreMap.get(site.id)?.healthGrade ?? null,
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
                fullAddress: sc.contractor.fullAddress,
                logo: sc.contractor.logo,
              },
            }),
          })),
        }),
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

    const site = await this.findOneOrFail({
      where: { id },
      relations,
    });

    // Transform response with limited relation fields
    const { company, siteContractors, createdByUser, updatedByUser, ...siteData } = site;

    return {
      ...siteData,
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
              fullAddress: sc.contractor.fullAddress,
              logo: sc.contractor.logo,
            },
          }),
        })),
      }),
      // Created by user with limited fields
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
      // Updated by user with limited fields
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

    const fullAddress = this.buildFullAddress({
      ...existingSite,
      ...updateDto,
    });

    return await this.dataSource.transaction(async (entityManager) => {
      // Update site
      const { contractorIds, startDate: startDateStr, endDate: endDateStr, ...dtoData } = updateDto;
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
        await this.siteRepository.removeContractors(id, undefined, entityManager);
        await this.siteRepository.addContractors(id, contractorIds, entityManager);
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
      [SiteStatus.UPCOMING]: [SiteStatus.ONGOING, SiteStatus.HOLD, SiteStatus.COMPLETED],
      [SiteStatus.ONGOING]: [SiteStatus.HOLD, SiteStatus.COMPLETED],
      [SiteStatus.HOLD]: [SiteStatus.ONGOING, SiteStatus.COMPLETED],
      [SiteStatus.COMPLETED]: [], // No transitions from completed
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
