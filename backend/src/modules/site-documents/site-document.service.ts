import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IsNull,
  ILike,
  FindOneOptions,
  Not,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { SiteDocumentRepository } from './site-document.repository';
import { SiteDocumentEntity } from './entities/site-document.entity';
import {
  CreateSiteDocumentDto,
  UpdateSiteDocumentDto,
  GetSiteDocumentDto,
  BulkCreateSiteDocumentDto,
  DocumentMetadataDto,
} from './dto';
import {
  SITE_DOCUMENT_ERRORS,
  SiteDocumentEntityFields,
  SiteDocumentStatus,
  DOCUMENT_TYPE_FIELD_MAPPING,
  BLOCKED_FINANCIAL_DOCUMENT_TYPES,
} from './constants/site-document.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import { SiteService } from '../sites/site.service';
import { ContractorService } from '../contractors/contractor.service';
import { VendorService } from '../vendors/vendor.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

/**
 * Site Document Service - Repurposed for non-financial documents only.
 * 
 * Financial documents (PO, INVOICE) have been moved to dedicated modules:
 * - purchase-orders, site-invoices, bank-transfers, etc.
 * 
 * This service now handles miscellaneous site documents like:
 * - Contracts, work orders, completion certificates
 * - Photos, inspection reports, etc.
 */
@Injectable()
export class SiteDocumentService {
  constructor(
    private readonly siteDocumentRepository: SiteDocumentRepository,
    private readonly siteService: SiteService,
    private readonly contractorService: ContractorService,
    private readonly vendorService: VendorService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createDto: CreateSiteDocumentDto, createdBy: string, fileKey?: string) {
    // Guard: Reject blocked financial document types
    this.rejectBlockedDocumentTypes(createDto.documentType);

    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: createDto.siteId, deletedAt: IsNull() } });

    // Validate contractor if provided
    if (createDto.contractorId) {
      await this.contractorService.findOneOrFail({
        where: { id: createDto.contractorId, deletedAt: IsNull() },
      });
    }

    // Validate vendor if provided
    if (createDto.vendorId) {
      await this.vendorService.findOneOrFail({
        where: { id: createDto.vendorId, deletedAt: IsNull() },
      });
    }

    // Validate document type against config
    await this.validateDocumentType(createDto.documentType);

    // Validate status if provided
    if (createDto.status) {
      await this.validateStatus(createDto.status);
    }

    // Check for duplicate document number (only if provided)
    if (createDto.documentNumber) {
      const existingDoc = await this.findOne({
        where: { documentNumber: createDto.documentNumber, deletedAt: IsNull() },
      });
      if (existingDoc) {
        throw new ConflictException(SITE_DOCUMENT_ERRORS.DOCUMENT_NUMBER_EXISTS);
      }
    }

    const documentData: Partial<SiteDocumentEntity> = {
      siteId: createDto.siteId,
      contractorId: createDto.contractorId || null,
      vendorId: createDto.vendorId || null,
      documentType: createDto.documentType,
      documentNumber: createDto.documentNumber || null,
      documentDate: new Date(createDto.documentDate),
      amount: createDto.amount ?? null,
      status: createDto.status || SiteDocumentStatus.DRAFT,
      remarks: createDto.remarks || null,
      createdBy,
    };

    // Add file key if provided
    if (fileKey) {
      documentData.fileUrl = fileKey;
    }

    const created = await this.siteDocumentRepository.create(documentData);

    return {
      ...this.utilityService.getSuccessMessage(
        SiteDocumentEntityFields.SITE_DOCUMENT,
        DataSuccessOperationType.CREATE,
      ),
      data: created,
    };
  }

  // Bulk create documents with different types in single API call
  async bulkCreate(
    bulkDto: BulkCreateSiteDocumentDto,
    createdBy: string,
    fileKeys: Record<string, string>,
  ) {
    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: bulkDto.siteId, deletedAt: IsNull() } });

    // Validate contractor if provided
    if (bulkDto.contractorId) {
      await this.contractorService.findOneOrFail({
        where: { id: bulkDto.contractorId, deletedAt: IsNull() },
      });
    }

    // Validate vendor if provided
    if (bulkDto.vendorId) {
      await this.vendorService.findOneOrFail({
        where: { id: bulkDto.vendorId, deletedAt: IsNull() },
      });
    }

    const documentsToCreate: Array<{
      metadata: DocumentMetadataDto;
      type: string;
      fileKey?: string;
    }> = [];

    // Collect documents to create using mapping from constants
    for (const [fieldName, docType] of Object.entries(DOCUMENT_TYPE_FIELD_MAPPING)) {
      const metadata = bulkDto[fieldName as keyof BulkCreateSiteDocumentDto] as
        | DocumentMetadataDto
        | undefined;
      if (metadata) {
        documentsToCreate.push({
          metadata,
          type: docType,
          fileKey: fileKeys[fieldName],
        });
      }
    }

    if (documentsToCreate.length === 0) {
      throw new BadRequestException('At least one document is required');
    }

    const createdDocuments: SiteDocumentEntity[] = [];
    const errors: string[] = [];

    // Create each document
    for (const doc of documentsToCreate) {
      try {
        // Guard: Reject blocked financial document types (should not happen with new mapping, but defense in depth)
        this.rejectBlockedDocumentTypes(doc.type);

        // Validate document type
        await this.validateDocumentType(doc.type);

        // Validate status if provided
        if (doc.metadata.status) {
          await this.validateStatus(doc.metadata.status);
        }

        // Check for duplicate document number
        if (doc.metadata.documentNumber) {
          const existingDoc = await this.findOne({
            where: { documentNumber: doc.metadata.documentNumber, deletedAt: IsNull() },
          });
          if (existingDoc) {
            errors.push(
              `${doc.type}: Document number ${doc.metadata.documentNumber} already exists`,
            );
            continue;
          }
        }

        const documentData: Partial<SiteDocumentEntity> = {
          siteId: bulkDto.siteId,
          contractorId: bulkDto.contractorId || null,
          vendorId: bulkDto.vendorId || null,
          documentType: doc.type,
          documentNumber: doc.metadata.documentNumber || null,
          documentDate: new Date(doc.metadata.documentDate),
          amount: doc.metadata.amount ?? null,
          status: doc.metadata.status || SiteDocumentStatus.DRAFT,
          remarks: doc.metadata.remarks || null,
          fileUrl: doc.fileKey || null,
          createdBy,
        };

        const created = await this.siteDocumentRepository.create(documentData);
        createdDocuments.push(created);
      } catch (error) {
        errors.push(`${doc.type}: ${error.message}`);
      }
    }

    return {
      message: `${createdDocuments.length} document(s) created successfully`,
      created: createdDocuments.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async findAll(options: GetSiteDocumentDto) {
    const {
      search,
      siteId,
      contractorId,
      vendorId,
      documentType,
      status,
      documentDateFrom,
      documentDateTo,
      includeSite,
      includeContractor,
      includeVendor,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    // Validate filter values against config
    if (documentType) {
      await this.validateDocumentType(documentType);
    }
    if (status) {
      await this.validateStatus(status);
    }

    const where: any = {
      deletedAt: IsNull(),
    };

    if (search) {
      where.documentNumber = ILike(`%${search}%`);
    }

    if (siteId) {
      where.siteId = siteId;
    }

    if (contractorId) {
      where.contractorId = contractorId;
    }

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (status) {
      where.status = status;
    }

    // Date range filters
    if (documentDateFrom && documentDateTo) {
      where.documentDate = Between(new Date(documentDateFrom), new Date(documentDateTo));
    } else if (documentDateFrom) {
      where.documentDate = MoreThanOrEqual(new Date(documentDateFrom));
    } else if (documentDateTo) {
      where.documentDate = LessThanOrEqual(new Date(documentDateTo));
    }

    const relations: string[] = [];
    if (includeSite) relations.push('site');
    if (includeContractor) relations.push('contractor');
    if (includeVendor) relations.push('vendor');

    const records = await this.siteDocumentRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalRecords = await this.siteDocumentRepository.count({ where });

    return this.utilityService.listResponse(records, totalRecords);
  }

  async findOne(options: FindOneOptions<SiteDocumentEntity>) {
    return await this.siteDocumentRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<SiteDocumentEntity>): Promise<SiteDocumentEntity> {
    const document = await this.siteDocumentRepository.findOne(options);

    if (!document) {
      throw new NotFoundException(SITE_DOCUMENT_ERRORS.NOT_FOUND);
    }

    return document;
  }

  async findById(id: string, includeRelations = true): Promise<SiteDocumentEntity> {
    const relations = includeRelations ? ['site', 'contractor', 'vendor'] : [];

    return await this.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async update(id: string, updateDto: UpdateSiteDocumentDto, updatedBy: string, fileKey?: string) {
    const existingDoc = await this.findOneOrFail({ where: { id } });

    // Guard: Reject blocked financial document types if changed
    if (updateDto.documentType) {
      this.rejectBlockedDocumentTypes(updateDto.documentType);
    }

    // Validate site if changed
    if (updateDto.siteId && updateDto.siteId !== existingDoc.siteId) {
      await this.siteService.findOneOrFail({
        where: { id: updateDto.siteId, deletedAt: IsNull() },
      });
    }

    // Validate contractor if changed
    if (updateDto.contractorId && updateDto.contractorId !== existingDoc.contractorId) {
      await this.contractorService.findOneOrFail({
        where: { id: updateDto.contractorId, deletedAt: IsNull() },
      });
    }

    // Validate vendor if changed
    if (updateDto.vendorId && updateDto.vendorId !== existingDoc.vendorId) {
      await this.vendorService.findOneOrFail({
        where: { id: updateDto.vendorId, deletedAt: IsNull() },
      });
    }

    // Validate document type if changed
    if (updateDto.documentType && updateDto.documentType !== existingDoc.documentType) {
      await this.validateDocumentType(updateDto.documentType);
    }

    // Validate status if changed (with transition validation)
    if (updateDto.status && updateDto.status !== existingDoc.status) {
      await this.validateStatus(updateDto.status);
      this.validateStatusTransition(existingDoc.status, updateDto.status);
    }

    // Check for duplicate document number if changed
    if (updateDto.documentNumber && updateDto.documentNumber !== existingDoc.documentNumber) {
      const duplicateDoc = await this.findOne({
        where: { documentNumber: updateDto.documentNumber, deletedAt: IsNull(), id: Not(id) },
      });
      if (duplicateDoc) {
        throw new ConflictException(SITE_DOCUMENT_ERRORS.DOCUMENT_NUMBER_EXISTS);
      }
    }

    // Destructure date field to handle separately
    const { documentDate, ...restDto } = updateDto;

    const updateData: Partial<SiteDocumentEntity> = {
      ...restDto,
      updatedBy,
    };

    // Handle date conversion
    if (documentDate) {
      updateData.documentDate = new Date(documentDate);
    }

    // Add file key if provided
    if (fileKey) {
      updateData.fileUrl = fileKey;
    }

    await this.siteDocumentRepository.update({ id }, updateData);

    return this.utilityService.getSuccessMessage(
      SiteDocumentEntityFields.SITE_DOCUMENT,
      DataSuccessOperationType.UPDATE,
    );
  }

  async remove(id: string, deletedBy: string) {
    await this.findOneOrFail({ where: { id } });

    await this.siteDocumentRepository.update({ id }, { deletedBy });
    await this.siteDocumentRepository.softDelete({ id });

    return this.utilityService.getSuccessMessage(
      SiteDocumentEntityFields.SITE_DOCUMENT,
      DataSuccessOperationType.DELETE,
    );
  }

  async restore(id: string): Promise<{ message: string; data: SiteDocumentEntity }> {
    const document = await this.siteDocumentRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!document) {
      throw new NotFoundException(SITE_DOCUMENT_ERRORS.NOT_FOUND);
    }

    await this.siteDocumentRepository.restore({ id });
    await this.siteDocumentRepository.update({ id }, { deletedBy: null });

    const restoredDocument = await this.findById(id);
    return {
      message: 'Site document restored successfully',
      data: restoredDocument,
    };
  }

  // Get documents by site
  async getDocumentsBySite(siteId: string, options?: Partial<GetSiteDocumentDto>) {
    await this.siteService.findOneOrFail({ where: { id: siteId, deletedAt: IsNull() } });
    return this.findAll({ ...options, siteId } as GetSiteDocumentDto);
  }

  // Get documents by contractor
  async getDocumentsByContractor(contractorId: string, options?: Partial<GetSiteDocumentDto>) {
    await this.contractorService.findOneOrFail({
      where: { id: contractorId, deletedAt: IsNull() },
    });
    return this.findAll({ ...options, contractorId } as GetSiteDocumentDto);
  }

  // Get documents by vendor
  async getDocumentsByVendor(vendorId: string, options?: Partial<GetSiteDocumentDto>) {
    await this.vendorService.findOneOrFail({
      where: { id: vendorId, deletedAt: IsNull() },
    });
    return this.findAll({ ...options, vendorId } as GetSiteDocumentDto);
  }

  /**
   * Guard to reject blocked financial document types (PO, INVOICE).
   * These should be created via dedicated financial modules.
   */
  private rejectBlockedDocumentTypes(documentType: string): void {
    if (BLOCKED_FINANCIAL_DOCUMENT_TYPES.includes(documentType.toUpperCase())) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.FINANCIAL_TYPE_NOT_ALLOWED);
    }
  }

  // Validate document type against config
  private async validateDocumentType(documentType: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_DOCUMENT_TYPES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.DOCUMENT_TYPE_CONFIG_NOT_FOUND);
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validTypes: string[] = [];
    for (const setting of settingsResult.records) {
      if (Array.isArray(setting.value)) {
        validTypes.push(...setting.value.map((v: any) => v.value || v));
      }
    }

    // Also filter out blocked types from valid types (even if config has them)
    const allowedTypes = validTypes.filter(
      (t) => !BLOCKED_FINANCIAL_DOCUMENT_TYPES.includes(t.toUpperCase()),
    );

    if (!allowedTypes.map((t) => t.toUpperCase()).includes(documentType.toUpperCase())) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_DOCUMENT_TYPE.replace('{type}', documentType).replace(
          '{available}',
          allowedTypes.join(', '),
        ),
      );
    }
  }

  // Validate status against config
  private async validateStatus(status: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_DOCUMENT_STATUSES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.STATUS_CONFIG_NOT_FOUND);
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validStatuses: string[] = [];
    for (const setting of settingsResult.records) {
      if (Array.isArray(setting.value)) {
        validStatuses.push(...setting.value.map((v: any) => v.value || v));
      }
    }

    if (!validStatuses.map((s) => s.toUpperCase()).includes(status.toUpperCase())) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_STATUS.replace('{status}', status).replace(
          '{available}',
          validStatuses.join(', '),
        ),
      );
    }
  }

  /**
   * Validate document status transitions.
   * Simplified: DRAFT | APPROVED | REJECTED
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [SiteDocumentStatus.DRAFT]: [SiteDocumentStatus.APPROVED, SiteDocumentStatus.REJECTED],
      [SiteDocumentStatus.APPROVED]: [], // No transitions from APPROVED (final state)
      [SiteDocumentStatus.REJECTED]: [SiteDocumentStatus.DRAFT], // Can revert to draft for re-review
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_STATUS_TRANSITION.replace('{from}', currentStatus).replace(
          '{to}',
          newStatus,
        ),
      );
    }
  }
}
