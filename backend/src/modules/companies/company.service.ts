import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, In, DataSource } from 'typeorm';
import { CompanyRepository } from './company.repository';
import { CompanyEntity } from './entities/company.entity';
import { CreateCompanyDto, UpdateCompanyDto, GetCompanyDto } from './dto';
import {
  COMPANY_ERRORS,
  COMPANY_RESPONSES,
  CompanyEntityFields,
} from './constants/company.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import {
  getSiteStatsByCompanyQuery,
  getChildCompanyStatsByParentQuery,
  getOverallCompanyStatsQuery,
  getCompanySiteCountQuery,
} from './queries/company.queries';
import { CompanyStats, OverallCompanyStats } from './company.types';

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly utilityService: UtilityService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateCompanyDto, createdBy: string, logoKey?: string) {
    // Check for unique name
    const existingCompany = await this.findOne({
      where: { name: ILike(createDto.name), deletedAt: IsNull() },
    });
    if (existingCompany) {
      throw new ConflictException(COMPANY_ERRORS.NAME_ALREADY_EXISTS);
    }

    // Check for unique email (if provided)
    if (createDto.email) {
      const emailConflict = await this.findOne({
        where: { email: ILike(createDto.email), deletedAt: IsNull() },
      });
      if (emailConflict) {
        throw new ConflictException(COMPANY_ERRORS.EMAIL_ALREADY_EXISTS);
      }
    }

    // Check for unique GST number (if provided)
    if (createDto.gstNumber) {
      const gstConflict = await this.findOne({
        where: { gstNumber: createDto.gstNumber, deletedAt: IsNull() },
      });
      if (gstConflict) {
        throw new ConflictException(COMPANY_ERRORS.GST_ALREADY_EXISTS);
      }
    }

    if (createDto.parentCompanyId) {
      const parentCompany = await this.companyRepository.findOne({
        where: { id: createDto.parentCompanyId },
      });
      if (!parentCompany) {
        throw new NotFoundException(COMPANY_ERRORS.PARENT_NOT_FOUND);
      }
    }

    const fullAddress = this.buildFullAddress(createDto);

    await this.companyRepository.create({
      ...createDto,
      logo: logoKey || null,
      fullAddress,
      createdBy,
    });

    return this.utilityService.getSuccessMessage(
      CompanyEntityFields.COMPANY,
      DataSuccessOperationType.CREATE,
    );
  }

  async findAll(options: GetCompanyDto) {
    const {
      search,
      city,
      state,
      parentCompanyId,
      isActive,
      onlyRootCompanies,
      includeChildren,
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

    // Multi-select support for city (array of values)
    if (city && city.length > 0) {
      where.city = In(city);
    }

    // Multi-select support for state (array of values)
    if (state && state.length > 0) {
      where.state = In(state);
    }

    // Multi-select support for parentCompanyId (array of UUIDs)
    // Returns both: the parent companies themselves AND their children
    let useArrayWhere = false;
    let whereConditions: any[] = [];

    if (parentCompanyId && parentCompanyId.length > 0 && !onlyRootCompanies) {
      useArrayWhere = true;
      // Condition 1: Companies where id matches (parent itself)
      whereConditions.push({ ...where, id: In(parentCompanyId) });
      // Condition 2: Companies where parentCompanyId matches (children)
      whereConditions.push({ ...where, parentCompanyId: In(parentCompanyId) });
    }

    if (onlyRootCompanies) {
      where.parentCompanyId = IsNull();
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
      // Also apply isActive to array conditions if using them
      if (useArrayWhere) {
        whereConditions = whereConditions.map((cond) => ({ ...cond, isActive }));
      }
    }

    const relations: string[] = ['parentCompany'];
    if (includeChildren) {
      relations.push('childCompanies');
    }

    // Use array of conditions for OR, or single where object
    const finalWhere = useArrayWhere ? whereConditions : where;

    const totalRecords = await this.companyRepository.count({ where: finalWhere });

    const records = await this.companyRepository.findAll({
      where: finalWhere,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get company IDs for stats computation
    const companyIds = records.map((c) => c.id);

    // Fetch individual company stats and overall stats in parallel
    const [statsMap, overallStats] = await Promise.all([
      this.getCompanyStats(companyIds),
      this.getOverallCompanyStats(),
    ]);

    // Transform records to include required parent company fields and stats
    const transformedRecords = records.map((company) => ({
      ...company,
      parentCompany: company.parentCompany
        ? {
            id: company.parentCompany.id,
            name: company.parentCompany.name,
            fullAddress: company.parentCompany.fullAddress,
            logo: company.parentCompany.logo,
          }
        : null,
      stats: statsMap.get(company.id) || {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        activeChildCompanies: 0,
        inactiveChildCompanies: 0,
        archivedChildCompanies: 0,
      },
    }));

    // Return response with overall company stats
    return {
      records: transformedRecords,
      totalRecords,
      overallStats,
    };
  }

  /**
   * Get stats for multiple companies in a single optimized query
   * Returns a Map of companyId -> CompanyStats
   */
  /**
   * Get stats for multiple companies in a single optimized query
   * Returns a Map of companyId -> CompanyStats
   */
  private async getCompanyStats(companyIds: string[]): Promise<Map<string, CompanyStats>> {
    const statsMap = new Map<string, CompanyStats>();

    if (companyIds.length === 0) {
      return statsMap;
    }

    // Execute both queries in parallel using imported queries
    const [siteStats, childStats] = await Promise.all([
      this.dataSource.query(getSiteStatsByCompanyQuery, [companyIds]),
      this.dataSource.query(getChildCompanyStatsByParentQuery, [companyIds]),
    ]);

    // Initialize stats for all companies
    for (const id of companyIds) {
      statsMap.set(id, {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        activeChildCompanies: 0,
        inactiveChildCompanies: 0,
        archivedChildCompanies: 0,
      });
    }

    // Populate site stats
    for (const row of siteStats) {
      const stats = statsMap.get(row.companyId);
      if (stats) {
        stats.totalSites = parseInt(row.totalSites) || 0;
        stats.activeSites = parseInt(row.activeSites) || 0;
        stats.upcomingSites = parseInt(row.upcomingSites) || 0;
        stats.completedSites = parseInt(row.completedSites) || 0;
        stats.holdSites = parseInt(row.holdSites) || 0;
      }
    }

    // Populate child company stats
    for (const row of childStats) {
      const stats = statsMap.get(row.parentCompanyId);
      if (stats) {
        stats.activeChildCompanies = parseInt(row.activeChildCompanies) || 0;
        stats.inactiveChildCompanies = parseInt(row.inactiveChildCompanies) || 0;
        stats.archivedChildCompanies = parseInt(row.archivedChildCompanies) || 0;
      }
    }

    return statsMap;
  }

  /**
   * Get overall company statistics (aggregate counts)
   */
  private async getOverallCompanyStats(): Promise<OverallCompanyStats> {
    const result = await this.dataSource.query(getOverallCompanyStatsQuery);
    const row = result[0] || {};

    return {
      totalCompanies: parseInt(row.totalCompanies) || 0,
      activeCompanies: parseInt(row.activeCompanies) || 0,
      inactiveCompanies: parseInt(row.inactiveCompanies) || 0,
      archivedCompanies: parseInt(row.archivedCompanies) || 0,
    };
  }

  async findOne(options: FindOneOptions<CompanyEntity>) {
    return await this.companyRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<CompanyEntity>): Promise<CompanyEntity> {
    const company = await this.companyRepository.findOne(options);

    if (!company) {
      throw new NotFoundException(COMPANY_ERRORS.NOT_FOUND);
    }

    return company;
  }

  async findById(id: string, includeChildren = false) {
    const relations = ['parentCompany', 'createdByUser', 'updatedByUser'];
    if (includeChildren) {
      relations.push('childCompanies');
    }

    const company = await this.findOneOrFail({
      where: { id },
      relations,
    });

    // Transform to only include required fields for related entities
    return {
      ...company,
      parentCompany: company.parentCompany
        ? {
            id: company.parentCompany.id,
            name: company.parentCompany.name,
            fullAddress: company.parentCompany.fullAddress,
            logo: company.parentCompany.logo,
          }
        : null,
      // Include user details for createdBy
      createdByUser: company.createdByUser
        ? {
            id: company.createdByUser.id,
            firstName: company.createdByUser.firstName,
            lastName: company.createdByUser.lastName,
            email: company.createdByUser.email,
            profilePicture: company.createdByUser.profilePicture,
          }
        : null,
      // Include user details for updatedBy
      updatedByUser: company.updatedByUser
        ? {
            id: company.updatedByUser.id,
            firstName: company.updatedByUser.firstName,
            lastName: company.updatedByUser.lastName,
            email: company.updatedByUser.email,
            profilePicture: company.updatedByUser.profilePicture,
          }
        : null,
    };
  }

  async update(id: string, updateDto: UpdateCompanyDto, updatedBy: string, logoKey?: string) {
    const existingCompany = await this.findOneOrFail({ where: { id } });

    // Check for unique name (if being updated)
    if (updateDto.name && updateDto.name !== existingCompany.name) {
      const nameConflict = await this.findOne({
        where: { name: ILike(updateDto.name), deletedAt: IsNull(), id: Not(id) },
      });
      if (nameConflict) {
        throw new ConflictException(COMPANY_ERRORS.NAME_ALREADY_EXISTS);
      }
    }

    // Check for unique email (if being updated)
    if (updateDto.email && updateDto.email !== existingCompany.email) {
      const emailConflict = await this.findOne({
        where: { email: ILike(updateDto.email), deletedAt: IsNull(), id: Not(id) },
      });
      if (emailConflict) {
        throw new ConflictException(COMPANY_ERRORS.EMAIL_ALREADY_EXISTS);
      }
    }

    // Check for unique GST number (if being updated)
    if (updateDto.gstNumber && updateDto.gstNumber !== existingCompany.gstNumber) {
      const gstConflict = await this.findOne({
        where: { gstNumber: updateDto.gstNumber, deletedAt: IsNull(), id: Not(id) },
      });
      if (gstConflict) {
        throw new ConflictException(COMPANY_ERRORS.GST_ALREADY_EXISTS);
      }
    }

    if (updateDto.parentCompanyId !== undefined) {
      if (updateDto.parentCompanyId) {
        if (updateDto.parentCompanyId === id) {
          throw new BadRequestException(COMPANY_ERRORS.CANNOT_BE_OWN_PARENT);
        }

        const parentCompany = await this.companyRepository.findOne({
          where: { id: updateDto.parentCompanyId },
        });
        if (!parentCompany) {
          throw new NotFoundException(COMPANY_ERRORS.PARENT_NOT_FOUND);
        }

        await this.checkCircularReference(id, updateDto.parentCompanyId);
      }
    }

    const fullAddress = this.buildFullAddress({
      ...existingCompany,
      ...updateDto,
    });

    const updateData: Partial<CompanyEntity> = {
      ...updateDto,
      fullAddress,
      updatedBy,
    };

    if (logoKey) {
      updateData.logo = logoKey;
    }

    await this.companyRepository.update({ id }, updateData);

    return this.utilityService.getSuccessMessage(
      CompanyEntityFields.COMPANY,
      DataSuccessOperationType.UPDATE,
    );
  }

  async remove(id: string, deletedBy: string) {
    await this.findOneOrFail({ where: { id } });

    const hasChildren = await this.hasChildCompanies(id);
    if (hasChildren) {
      throw new BadRequestException(COMPANY_ERRORS.CANNOT_DELETE_HAS_CHILDREN);
    }

    // Check if company has sites
    const hasSites = await this.hasActiveSites(id);
    if (hasSites) {
      throw new BadRequestException(COMPANY_ERRORS.CANNOT_DELETE_HAS_SITES);
    }

    await this.companyRepository.update({ id }, { deletedBy });
    await this.companyRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      CompanyEntityFields.COMPANY,
      DataSuccessOperationType.DELETE,
    );
  }

  /**
   * Check if a company has any active (non-deleted) sites
   */
  private async hasActiveSites(companyId: string): Promise<boolean> {
    const result = await this.dataSource.query(getCompanySiteCountQuery, [companyId]);
    const siteCount = parseInt(result[0]?.siteCount) || 0;
    return siteCount > 0;
  }

  /**
   * Bulk delete companies
   * Returns results with success and error details for each company
   */
  async bulkDelete(companyIds: string[], deletedBy: string) {
    const results: { id: string; success: boolean; message: string }[] = [];

    for (const companyId of companyIds) {
      try {
        // Check if company exists
        const company = await this.companyRepository.findOne({
          where: { id: companyId, deletedAt: IsNull() },
        });

        if (!company) {
          results.push({
            id: companyId,
            success: false,
            message: COMPANY_ERRORS.NOT_FOUND,
          });
          continue;
        }

        // Check if company has children
        const hasChildren = await this.hasChildCompanies(companyId);
        if (hasChildren) {
          results.push({
            id: companyId,
            success: false,
            message: COMPANY_ERRORS.CANNOT_DELETE_HAS_CHILDREN,
          });
          continue;
        }

        // Check if company has sites
        const hasSites = await this.hasActiveSites(companyId);
        if (hasSites) {
          results.push({
            id: companyId,
            success: false,
            message: COMPANY_ERRORS.CANNOT_DELETE_HAS_SITES,
          });
          continue;
        }

        // Soft delete the company
        await this.companyRepository.update({ id: companyId }, { deletedBy });
        await this.companyRepository.softDelete({ id: companyId });

        results.push({
          id: companyId,
          success: true,
          message: 'Company deleted successfully',
        });
      } catch (error) {
        results.push({
          id: companyId,
          success: false,
          message: error.message || 'Failed to delete company',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      message: `Bulk delete completed: ${successCount} succeeded, ${failureCount} failed`,
      totalRequested: companyIds.length,
      successCount,
      failureCount,
      results,
    };
  }

  async restore(id: string) {
    const company = await this.companyRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!company) {
      throw new NotFoundException(COMPANY_ERRORS.NOT_FOUND);
    }

    await this.companyRepository.restore({ id });
    await this.companyRepository.update({ id }, { deletedBy: null });

    const restoredCompany = await this.findById(id);
    return {
      message: COMPANY_RESPONSES.RESTORED,
      data: restoredCompany,
    };
  }

  async getHierarchy(id: string): Promise<CompanyEntity[]> {
    const company = await this.findOneOrFail({ where: { id } });
    const hierarchy: CompanyEntity[] = [company];

    let currentCompany = company;
    while (currentCompany.parentCompanyId) {
      const parent = await this.companyRepository.findOne({
        where: { id: currentCompany.parentCompanyId },
      });
      if (!parent) break;
      hierarchy.unshift(parent);
      currentCompany = parent;
    }

    return hierarchy;
  }

  private async hasChildCompanies(companyId: string): Promise<boolean> {
    const count = await this.companyRepository.count({
      where: { parentCompanyId: companyId, deletedAt: IsNull() },
    });
    return count > 0;
  }

  private buildFullAddress(data: Partial<CreateCompanyDto>): string {
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

  private async checkCircularReference(companyId: string, newParentId: string): Promise<void> {
    const descendants = await this.getAllDescendants(companyId);

    if (descendants.includes(newParentId)) {
      throw new BadRequestException(COMPANY_ERRORS.CIRCULAR_REFERENCE);
    }
  }

  private async getAllDescendants(companyId: string): Promise<string[]> {
    const descendants: string[] = [];
    const toProcess: string[] = [companyId];

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()!;

      const children = await this.companyRepository.findAll({
        where: { parentCompanyId: currentId, deletedAt: IsNull() },
      });

      for (const child of children) {
        if (!descendants.includes(child.id)) {
          descendants.push(child.id);
          toProcess.push(child.id);
        }
      }
    }

    return descendants;
  }
}
