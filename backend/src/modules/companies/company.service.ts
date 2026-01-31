import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IsNull, ILike, FindOneOptions, Not, In } from 'typeorm';
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

@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createDto: CreateCompanyDto, createdBy: string, logoKey?: string) {
    const existingCompany = await this.findOne({
      where: { name: ILike(createDto.name), deletedAt: IsNull() },
    });
    if (existingCompany) {
      throw new ConflictException(COMPANY_ERRORS.NAME_ALREADY_EXISTS);
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
    if (parentCompanyId && parentCompanyId.length > 0) {
      where.parentCompanyId = In(parentCompanyId);
    }

    if (onlyRootCompanies) {
      where.parentCompanyId = IsNull();
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const relations: string[] = ['parentCompany'];
    if (includeChildren) {
      relations.push('childCompanies');
    }

    const totalRecords = await this.companyRepository.count({ where });

    const records = await this.companyRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Transform records to only include required parent company fields
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
    }));

    return this.utilityService.listResponse(transformedRecords, totalRecords);
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

  async findById(id: string, includeChildren = false): Promise<CompanyEntity> {
    const relations = ['parentCompany'];
    if (includeChildren) {
      relations.push('childCompanies');
    }

    return await this.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async update(id: string, updateDto: UpdateCompanyDto, updatedBy: string, logoKey?: string) {
    const existingCompany = await this.findOneOrFail({ where: { id } });

    if (updateDto.name && updateDto.name !== existingCompany.name) {
      const nameConflict = await this.findOne({
        where: { name: ILike(updateDto.name), deletedAt: IsNull(), id: Not(id) },
      });
      if (nameConflict) {
        throw new ConflictException(COMPANY_ERRORS.NAME_ALREADY_EXISTS);
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

    // TODO: Check if company has sites (will be added when Site module is created)

    await this.companyRepository.update({ id }, { deletedBy });
    await this.companyRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      CompanyEntityFields.COMPANY,
      DataSuccessOperationType.DELETE,
    );
  }

  async restore(id: string): Promise<{ message: string; data: CompanyEntity }> {
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
