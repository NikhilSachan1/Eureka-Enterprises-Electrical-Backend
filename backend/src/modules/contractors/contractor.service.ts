import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource } from 'typeorm';
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
} from './queries/contractor.queries';

// Interface for individual contractor stats
interface ContractorStats {
  totalSites: number;
  activeSites: number;
  upcomingSites: number;
  completedSites: number;
  holdSites: number;
  totalDocuments: number;
  totalInvoices: number;
  totalQuotations: number;
  totalAmountBilled: number;
  pendingPayments: number;
}

// Interface for overall contractor stats (aggregate)
interface OverallContractorStats {
  totalContractors: number;
  activeContractors: number;
  inactiveContractors: number;
  archivedContractors: number;
  selfContractors: number;
}

@Injectable()
export class ContractorService {
  constructor(
    private readonly contractorRepository: ContractorRepository,
    private readonly utilityService: UtilityService,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateContractorDto, createdBy: string) {
    // Check for duplicate name
    const existingByName = await this.findOne({
      where: { name: ILike(createDto.name), deletedAt: IsNull() },
    });
    if (existingByName) {
      throw new ConflictException(CONTRACTOR_ERRORS.NAME_ALREADY_EXISTS);
    }

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

    if (city) {
      where.city = ILike(`%${city}%`);
    }

    if (state) {
      where.state = ILike(`%${state}%`);
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

    // Check for duplicate name (excluding current)
    if (updateDto.name && updateDto.name !== existingContractor.name) {
      const nameConflict = await this.findOne({
        where: { name: ILike(updateDto.name), deletedAt: IsNull(), id: Not(id) },
      });
      if (nameConflict) {
        throw new ConflictException(CONTRACTOR_ERRORS.NAME_ALREADY_EXISTS);
      }
    }

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

    // TODO: Check if contractor has sites (will be added when Site module is created)

    await this.contractorRepository.update({ id }, { deletedBy });
    await this.contractorRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      ContractorEntityFields.CONTRACTOR,
      DataSuccessOperationType.DELETE,
    );
  }

  async restore(id: string) {
    const contractor = await this.contractorRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!contractor) {
      throw new NotFoundException(CONTRACTOR_ERRORS.NOT_FOUND);
    }

    await this.contractorRepository.restore({ id });
    await this.contractorRepository.update({ id }, { deletedBy: null });

    const restoredContractor = await this.findById(id);
    return {
      message: CONTRACTOR_RESPONSES.RESTORED,
      data: restoredContractor,
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
