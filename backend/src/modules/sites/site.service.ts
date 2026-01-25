import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, DataSource } from 'typeorm';
import { SiteRepository } from './site.repository';
import { SiteEntity } from './entities/site.entity';
import { CreateSiteDto, UpdateSiteDto, GetSiteDto, UpdateSiteStatusDto } from './dto';
import {
  SITE_ERRORS,
  SITE_RESPONSES,
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

    if (companyId) {
      where.companyId = companyId;
    }

    if (managerName) {
      where.managerName = ILike(`%${managerName}%`);
    }

    if (status) {
      where.status = status;
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
    if (contractorId) {
      records = records.filter((site) =>
        site.siteContractors?.some((sc) => sc.contractorId === contractorId),
      );
    }

    const totalRecords = await this.siteRepository.count({ where });

    return this.utilityService.listResponse(records, totalRecords);
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

  async findById(id: string, includeRelations = true): Promise<SiteEntity> {
    const relations = includeRelations
      ? ['company', 'siteContractors', 'siteContractors.contractor']
      : [];

    return await this.findOneOrFail({
      where: { id },
      relations,
    });
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

    await this.siteRepository.update(
      { id },
      {
        status: updateStatusDto.status,
        updatedBy,
      },
    );

    return { message: SITE_RESPONSES.STATUS_UPDATED };
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

  async restore(id: string): Promise<{ message: string; data: SiteEntity }> {
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
