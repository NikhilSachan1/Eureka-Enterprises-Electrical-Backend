import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource, In } from 'typeorm';
import { ContractorRepository } from './contractor.repository';
import { ContractorEntity } from './entities/contractor.entity';
import { CreateContractorDto, UpdateContractorDto, GetContractorDto } from './dto';
import {
  CONTRACTOR_ERRORS,
  CONTRACTOR_RESPONSES,
  ContractorEntityFields,
} from './constants/contractor.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import {
  getSiteStatsByContractorQuery,
  getDocumentStatsByContractorQuery,
  getOverallContractorStatsQuery,
  checkContractorHasSitesQuery,
  checkContractorHasPendingInvoicesQuery,
} from './queries/contractor.queries';
import { ContractorStats, OverallContractorStats } from './contractor.types';

@Injectable()
export class ContractorService {
  constructor(
    private readonly contractorRepository: ContractorRepository,
    private readonly utilityService: UtilityService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateContractorDto, createdBy: string) {
    // Check for duplicate GST (only if provided)
    if (createDto.gstNumber) {
      const existingByGst = await this.findOne({
        where: { gstNumber: createDto.gstNumber, deletedAt: IsNull() },
      });
      if (existingByGst) {
        throw new ConflictException(CONTRACTOR_ERRORS.GST_ALREADY_EXISTS);
      }
    }

    const fullAddress = this.buildFullAddress(createDto);

    await this.contractorRepository.create({
      ...createDto,
      fullAddress,
      createdBy,
    });

    return this.utilityService.getSuccessMessage(
      ContractorEntityFields.CONTRACTOR,
      DataSuccessOperationType.CREATE,
    );
  }

  async findAll(options: GetContractorDto) {
    const {
      search,
      city,
      state,
      isActive,
      excludeSelfContractor,
      onlySelfContractor,
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

    if (excludeSelfContractor) {
      where.isSelfContractor = false;
    }

    if (onlySelfContractor) {
      where.isSelfContractor = true;
    }

    const totalRecords = await this.contractorRepository.count({ where });

    const records = await this.contractorRepository.findAll({
      where,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get contractor IDs for stats computation
    const contractorIds = records.map((c) => c.id);

    // Fetch individual contractor stats and overall stats in parallel
    const [statsMap, overallStats] = await Promise.all([
      this.getContractorStats(contractorIds),
      this.getOverallContractorStats(),
    ]);

    // Transform records to include stats
    const transformedRecords = records.map((contractor) => ({
      ...contractor,
      stats: statsMap.get(contractor.id) || {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        totalDocuments: 0,
        totalInvoices: 0,
        totalQuotations: 0,
        totalAmountBilled: 0,
        pendingPayments: 0,
      },
    }));

    // Return response with overall contractor stats
    return {
      records: transformedRecords,
      totalRecords,
      overallStats,
    };
  }

  async findOne(options: FindOneOptions<ContractorEntity>) {
    return await this.contractorRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<ContractorEntity>): Promise<ContractorEntity> {
    const contractor = await this.contractorRepository.findOne(options);

    if (!contractor) {
      throw new NotFoundException(CONTRACTOR_ERRORS.NOT_FOUND);
    }

    return contractor;
  }

  async findById(id: string) {
    const contractor = await this.findOneOrFail({
      where: { id },
      relations: ['createdByUser', 'updatedByUser'],
    });

    // Transform to only include required fields for related user entities
    return {
      ...contractor,
      // Include user details for createdBy
      createdByUser: contractor.createdByUser
        ? {
            id: contractor.createdByUser.id,
            employeeId: contractor.createdByUser.employeeId,
            firstName: contractor.createdByUser.firstName,
            lastName: contractor.createdByUser.lastName,
            email: contractor.createdByUser.email,
            profilePicture: contractor.createdByUser.profilePicture,
          }
        : null,
      // Include user details for updatedBy
      updatedByUser: contractor.updatedByUser
        ? {
            id: contractor.updatedByUser.id,
            employeeId: contractor.updatedByUser.employeeId,
            firstName: contractor.updatedByUser.firstName,
            lastName: contractor.updatedByUser.lastName,
            email: contractor.updatedByUser.email,
            profilePicture: contractor.updatedByUser.profilePicture,
          }
        : null,
    };
  }

  async update(id: string, updateDto: UpdateContractorDto, updatedBy: string) {
    const existingContractor = await this.findOneOrFail({ where: { id } });

    // Check for duplicate GST (excluding current)
    if (updateDto.gstNumber && updateDto.gstNumber !== existingContractor.gstNumber) {
      const gstConflict = await this.findOne({
        where: { gstNumber: updateDto.gstNumber, deletedAt: IsNull(), id: Not(id) },
      });
      if (gstConflict) {
        throw new ConflictException(CONTRACTOR_ERRORS.GST_ALREADY_EXISTS);
      }
    }

    const fullAddress = this.buildFullAddress({
      ...existingContractor,
      ...updateDto,
    });

    const updateData: Partial<ContractorEntity> = {
      ...updateDto,
      fullAddress,
      updatedBy,
    };

    await this.contractorRepository.update({ id }, updateData);

    return this.utilityService.getSuccessMessage(
      ContractorEntityFields.CONTRACTOR,
      DataSuccessOperationType.UPDATE,
    );
  }

  async remove(id: string, deletedBy: string) {
    const contractor = await this.findOneOrFail({ where: { id } });

    // Prevent deletion of self contractor
    if (contractor.isSelfContractor) {
      throw new BadRequestException(CONTRACTOR_ERRORS.CANNOT_DELETE_SELF_CONTRACTOR);
    }

    await this.validateContractorCanBeDeleted(id);

    await this.contractorRepository.update({ id }, { deletedBy });
    await this.contractorRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      ContractorEntityFields.CONTRACTOR,
      DataSuccessOperationType.DELETE,
    );
  }

  /**
   * Validate that a contractor can be deleted by checking all active associations.
   * Runs all checks in parallel and throws a single error listing every violation found.
   */
  private async validateContractorCanBeDeleted(contractorId: string): Promise<void> {
    // site_documents.paymentStatus was dropped by the financial-module
    // repurposing migration (1835000000000). The "has pending payments"
    // check now lives on site_invoices: a contractor has pending payments
    // if any approved invoice is not yet fully covered by bank transfers
    // (paidTotal < totalAmount).
    const checks = [
      {
        query: checkContractorHasSitesQuery,
        message: CONTRACTOR_ERRORS.CANNOT_DELETE_HAS_SITES,
      },
      {
        query: checkContractorHasPendingInvoicesQuery,
        message: CONTRACTOR_ERRORS.CONTRACTOR_HAS_PENDING_DOCUMENTS,
      },
    ];

    const results = await Promise.all(
      checks.map(({ query }) => this.dataSource.query(query, [contractorId])),
    );

    const violations = checks.filter((_, i) => results[i].length > 0).map(({ message }) => message);

    if (violations.length > 0) {
      throw new BadRequestException(
        CONTRACTOR_ERRORS.CONTRACTOR_HAS_ACTIVE_ASSOCIATIONS.replace(
          '{issues}',
          violations.map((v, i) => `${i + 1}. ${v}`).join(' '),
        ),
      );
    }
  }

  /**
   * Bulk delete contractors
   * Returns results with success and error details for each contractor
   */
  async bulkDelete(contractorIds: string[], deletedBy: string) {
    const results: { id: string; success: boolean; message: string }[] = [];

    for (const contractorId of contractorIds) {
      try {
        // Check if contractor exists
        const contractor = await this.contractorRepository.findOne({
          where: { id: contractorId, deletedAt: IsNull() },
        });

        if (!contractor) {
          results.push({
            id: contractorId,
            success: false,
            message: CONTRACTOR_ERRORS.NOT_FOUND,
          });
          continue;
        }

        // Prevent deletion of self contractor
        if (contractor.isSelfContractor) {
          results.push({
            id: contractorId,
            success: false,
            message: CONTRACTOR_ERRORS.CANNOT_DELETE_SELF_CONTRACTOR,
          });
          continue;
        }

        // Check all deletion preconditions
        await this.validateContractorCanBeDeleted(contractorId);

        // Soft delete the contractor
        await this.contractorRepository.update({ id: contractorId }, { deletedBy });
        await this.contractorRepository.softDelete({ id: contractorId });

        results.push({
          id: contractorId,
          success: true,
          message: CONTRACTOR_RESPONSES.DELETED,
        });
      } catch (error) {
        results.push({
          id: contractorId,
          success: false,
          message: error.message || CONTRACTOR_ERRORS.DELETE_FAILED,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      message: CONTRACTOR_RESPONSES.BULK_DELETE_COMPLETED(successCount, failureCount),
      totalRequested: contractorIds.length,
      successCount,
      failureCount,
      results,
    };
  }

  async restore(id: string) {
    const contractor = await this.contractorRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!contractor) {
      throw new NotFoundException(CONTRACTOR_ERRORS.NOT_FOUND);
    }

    // Restore the soft-deleted record
    await this.contractorRepository.restore({ id });

    // Clear deletedBy and set isActive to true
    await this.contractorRepository.update({ id }, { deletedBy: null, isActive: true });

    return {
      message: CONTRACTOR_RESPONSES.RESTORED,
    };
  }

  /**
   * Get stats for multiple contractors in a single optimized query
   * Returns a Map of contractorId -> ContractorStats
   */
  private async getContractorStats(contractorIds: string[]): Promise<Map<string, ContractorStats>> {
    const statsMap = new Map<string, ContractorStats>();

    if (contractorIds.length === 0) {
      return statsMap;
    }

    // Execute both queries in parallel using imported queries
    const [siteStats, documentStats] = await Promise.all([
      this.dataSource.query(getSiteStatsByContractorQuery, [contractorIds]),
      this.dataSource.query(getDocumentStatsByContractorQuery, [contractorIds]),
    ]);

    // Initialize stats for all contractors
    for (const id of contractorIds) {
      statsMap.set(id, {
        totalSites: 0,
        activeSites: 0,
        upcomingSites: 0,
        completedSites: 0,
        holdSites: 0,
        totalDocuments: 0,
        totalInvoices: 0,
        totalQuotations: 0,
        totalAmountBilled: 0,
        pendingPayments: 0,
      });
    }

    // Populate site stats
    for (const row of siteStats) {
      const stats = statsMap.get(row.contractorId);
      if (stats) {
        stats.totalSites = parseInt(row.totalSites) || 0;
        stats.activeSites = parseInt(row.activeSites) || 0;
        stats.upcomingSites = parseInt(row.upcomingSites) || 0;
        stats.completedSites = parseInt(row.completedSites) || 0;
        stats.holdSites = parseInt(row.holdSites) || 0;
      }
    }

    // Populate document stats
    for (const row of documentStats) {
      const stats = statsMap.get(row.contractorId);
      if (stats) {
        stats.totalDocuments = parseInt(row.totalDocuments) || 0;
        stats.totalInvoices = parseInt(row.totalInvoices) || 0;
        stats.totalQuotations = parseInt(row.totalQuotations) || 0;
        stats.totalAmountBilled = parseFloat(row.totalAmountBilled) || 0;
        stats.pendingPayments = parseInt(row.pendingPayments) || 0;
      }
    }

    return statsMap;
  }

  /**
   * Get overall contractor statistics (aggregate counts)
   */
  private async getOverallContractorStats(): Promise<OverallContractorStats> {
    const result = await this.dataSource.query(getOverallContractorStatsQuery);
    const row = result[0] || {};

    return {
      totalContractors: parseInt(row.totalContractors) || 0,
      activeContractors: parseInt(row.activeContractors) || 0,
      inactiveContractors: parseInt(row.inactiveContractors) || 0,
      archivedContractors: parseInt(row.archivedContractors) || 0,
      selfContractors: parseInt(row.selfContractors) || 0,
    };
  }

  private buildFullAddress(data: Partial<CreateContractorDto>): string {
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
