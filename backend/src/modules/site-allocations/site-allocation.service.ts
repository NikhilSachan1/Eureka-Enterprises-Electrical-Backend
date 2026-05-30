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
  ManageSiteAllocationDto,
} from './dto';
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
import { SiteService } from '../sites/site.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

@Injectable()
export class SiteAllocationService {
  constructor(
    private readonly siteAllocationRepository: SiteAllocationRepository,
    private readonly siteService: SiteService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createDto: CreateSiteAllocationDto, createdBy: string) {
    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: createDto.siteId } });

    // Check if employee is already allocated to another site
    // Note: User existence is validated by FK constraint
    const currentAllocation = await this.findOne({
      where: { userId: createDto.userId, isCurrentlyAllocated: true, deletedAt: IsNull() },
      relations: ['site'],
    });
    if (currentAllocation) {
      if (currentAllocation.siteId === createDto.siteId) {
        throw new ConflictException(SITE_ALLOCATION_ERRORS.EMPLOYEE_ALREADY_IN_SITE);
      }
      throw new ConflictException(SITE_ALLOCATION_ERRORS.EMPLOYEE_ALREADY_ALLOCATED);
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
      allocatedAt: new Date(createDto.allocatedAt),
      isCurrentlyAllocated: true,
      remarks: createDto.remarks,
      createdBy,
    });

    return this.utilityService.getSuccessMessage(
      SiteAllocationEntityFields.SITE_ALLOCATION,
      DataSuccessOperationType.CREATE,
    );
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

    // Cannot update deallocated records
    if (!existingAllocation.isCurrentlyAllocated) {
      throw new BadRequestException(SITE_ALLOCATION_ERRORS.CANNOT_UPDATE_DEALLOCATED);
    }

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

    await this.siteAllocationRepository.update(
      { id },
      {
        ...updateDto,
        updatedBy,
      },
    );

    return this.utilityService.getSuccessMessage(
      SiteAllocationEntityFields.SITE_ALLOCATION,
      DataSuccessOperationType.UPDATE,
    );
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

    // Process deallocations
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
