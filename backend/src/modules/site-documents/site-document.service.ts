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
  LessThan,
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
  SITE_DOCUMENT_RESPONSES,
  SiteDocumentEntityFields,
  SiteDocumentStatus,
  SiteDocumentPaymentStatus,
  SiteDocumentDirection,
  DOCUMENT_TYPE_FIELD_MAPPING,
} from './constants/site-document.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import { SiteService } from '../sites/site.service';
import { ContractorService } from '../contractors/contractor.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';

@Injectable()
export class SiteDocumentService {
  constructor(
    private readonly siteDocumentRepository: SiteDocumentRepository,
    private readonly siteService: SiteService,
    private readonly contractorService: ContractorService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createDto: CreateSiteDocumentDto, createdBy: string, fileKey?: string) {
    // Validate site exists
    await this.siteService.findOneOrFail({ where: { id: createDto.siteId, deletedAt: IsNull() } });

    // Validate contractor if provided
    if (createDto.contractorId) {
      await this.contractorService.findOneOrFail({
        where: { id: createDto.contractorId, deletedAt: IsNull() },
      });
    }

    // Validate document type
    await this.validateDocumentType(createDto.documentType);

    // Validate status if provided
    if (createDto.status) {
      await this.validateStatus(createDto.status);
    }

    // Validate payment status if provided
    if (createDto.paymentStatus) {
      await this.validatePaymentStatus(createDto.paymentStatus);
    }

    // Validate direction if provided
    if (createDto.direction) {
      await this.validateDirection(createDto.direction);
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

    // Calculate amounts (default to 0 for non-financial documents)
    const amount = createDto.amount || 0;
    const gstAmount = createDto.gstAmount || 0;
    const totalAmount = createDto.totalAmount || amount + gstAmount;

    // Validate total amount calculation (only if explicitly provided)
    if (
      createDto.totalAmount &&
      createDto.amount &&
      Math.abs(createDto.totalAmount - (amount + gstAmount)) > 0.01
    ) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.INVALID_AMOUNT);
    }

    // Direction: only set if there's an amount, otherwise null (non-financial doc)
    let direction: string | null = null;
    if (amount > 0) {
      direction = createDto.direction || SiteDocumentDirection.PAYABLE;
    }

    const documentData: Partial<SiteDocumentEntity> = {
      siteId: createDto.siteId,
      contractorId: createDto.contractorId || null,
      documentType: createDto.documentType,
      direction,
      documentNumber: createDto.documentNumber || null,
      documentDate: new Date(createDto.documentDate),
      amount,
      gstAmount,
      totalAmount,
      status: createDto.status || SiteDocumentStatus.DRAFT,
      paymentStatus: createDto.paymentStatus || SiteDocumentPaymentStatus.PENDING,
      paymentDate: createDto.paymentDate ? new Date(createDto.paymentDate) : null,
      paymentReference: createDto.paymentReference || null,
      dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
      remarks: createDto.remarks || null,
      createdBy,
    };

    // Add file key if provided
    if (fileKey) {
      documentData.fileUrl = fileKey;
    }

    await this.siteDocumentRepository.create(documentData);

    return this.utilityService.getSuccessMessage(
      SiteDocumentEntityFields.SITE_DOCUMENT,
      DataSuccessOperationType.CREATE,
    );
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
        // Validate document type
        await this.validateDocumentType(doc.type);

        // Validate status if provided
        if (doc.metadata.status) {
          await this.validateStatus(doc.metadata.status);
        }

        // Validate payment status if provided
        if (doc.metadata.paymentStatus) {
          await this.validatePaymentStatus(doc.metadata.paymentStatus);
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

        // Calculate amounts (default to 0 for non-financial documents)
        const amount = doc.metadata.amount || 0;
        const gstAmount = doc.metadata.gstAmount || 0;
        const totalAmount = doc.metadata.totalAmount || amount + gstAmount;

        // Direction: only set if there's an amount, otherwise null (non-financial doc)
        // For bulk, we default based on document type
        let direction: string | null = null;
        if (amount > 0) {
          // PO is always PAYABLE, others default to PAYABLE but can be overridden
          direction = SiteDocumentDirection.PAYABLE;
        }

        const documentData: Partial<SiteDocumentEntity> = {
          siteId: bulkDto.siteId,
          contractorId: bulkDto.contractorId || null,
          documentType: doc.type,
          direction,
          documentNumber: doc.metadata.documentNumber || null,
          documentDate: new Date(doc.metadata.documentDate),
          amount,
          gstAmount,
          totalAmount,
          status: doc.metadata.status || SiteDocumentStatus.DRAFT,
          paymentStatus: doc.metadata.paymentStatus || SiteDocumentPaymentStatus.PENDING,
          dueDate: doc.metadata.dueDate ? new Date(doc.metadata.dueDate) : null,
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
      documentType,
      direction,
      status,
      paymentStatus,
      documentDateFrom,
      documentDateTo,
      dueDateFrom,
      dueDateTo,
      overdueOnly,
      includeSite,
      includeContractor,
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
    if (paymentStatus) {
      await this.validatePaymentStatus(paymentStatus);
    }
    if (direction) {
      await this.validateDirection(direction);
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

    if (documentType) {
      where.documentType = documentType;
    }

    if (direction) {
      where.direction = direction;
    }

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    // Date range filters
    if (documentDateFrom && documentDateTo) {
      where.documentDate = Between(new Date(documentDateFrom), new Date(documentDateTo));
    } else if (documentDateFrom) {
      where.documentDate = MoreThanOrEqual(new Date(documentDateFrom));
    } else if (documentDateTo) {
      where.documentDate = LessThanOrEqual(new Date(documentDateTo));
    }

    if (dueDateFrom && dueDateTo) {
      where.dueDate = Between(new Date(dueDateFrom), new Date(dueDateTo));
    } else if (dueDateFrom) {
      where.dueDate = MoreThanOrEqual(new Date(dueDateFrom));
    } else if (dueDateTo) {
      where.dueDate = LessThanOrEqual(new Date(dueDateTo));
    }

    // Overdue filter
    if (overdueOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.dueDate = LessThan(today);
      where.paymentStatus = Not(SiteDocumentPaymentStatus.PAID);
    }

    const relations: string[] = [];
    if (includeSite) relations.push('site');
    if (includeContractor) relations.push('contractor');

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
    const relations = includeRelations ? ['site', 'contractor'] : [];

    return await this.findOneOrFail({
      where: { id },
      relations,
    });
  }

  async update(id: string, updateDto: UpdateSiteDocumentDto, updatedBy: string, fileKey?: string) {
    const existingDoc = await this.findOneOrFail({ where: { id } });

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

    // Validate document type if changed
    if (updateDto.documentType && updateDto.documentType !== existingDoc.documentType) {
      await this.validateDocumentType(updateDto.documentType);
    }

    // Validate status if changed (with transition validation)
    if (updateDto.status && updateDto.status !== existingDoc.status) {
      await this.validateStatus(updateDto.status);
      this.validateStatusTransition(existingDoc.status, updateDto.status);
    }

    // Validate payment status if changed (with transition validation)
    if (updateDto.paymentStatus && updateDto.paymentStatus !== existingDoc.paymentStatus) {
      await this.validatePaymentStatus(updateDto.paymentStatus);
      this.validatePaymentStatusTransition(existingDoc.paymentStatus, updateDto.paymentStatus);
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

    // Calculate amounts
    const amount = updateDto.amount ?? existingDoc.amount;
    const gstAmount = updateDto.gstAmount ?? existingDoc.gstAmount;
    const totalAmount = updateDto.totalAmount ?? amount + gstAmount;

    // Validate total amount if explicitly provided
    if (updateDto.totalAmount && Math.abs(updateDto.totalAmount - (amount + gstAmount)) > 0.01) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.INVALID_AMOUNT);
    }

    // Destructure date fields to handle separately
    const { documentDate, paymentDate, dueDate, ...restDto } = updateDto;

    const updateData: Partial<SiteDocumentEntity> = {
      ...restDto,
      amount,
      gstAmount,
      totalAmount,
      updatedBy,
    };

    // Handle date conversions
    if (documentDate) {
      updateData.documentDate = new Date(documentDate);
    }
    if (paymentDate) {
      updateData.paymentDate = new Date(paymentDate);
    }
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
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
      message: SITE_DOCUMENT_RESPONSES.RESTORED,
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

    if (!validTypes.map((t) => t.toUpperCase()).includes(documentType.toUpperCase())) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_DOCUMENT_TYPE.replace('{type}', documentType).replace(
          '{available}',
          validTypes.join(', '),
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

  // Validate payment status against config
  private async validatePaymentStatus(paymentStatus: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.SITE_DOCUMENT_PAYMENT_STATUSES,
        module: CONFIGURATION_MODULES.SITE,
      },
    });

    if (!config) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.PAYMENT_STATUS_CONFIG_NOT_FOUND);
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

    if (!validStatuses.map((s) => s.toUpperCase()).includes(paymentStatus.toUpperCase())) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_PAYMENT_STATUS.replace('{status}', paymentStatus).replace(
          '{available}',
          validStatuses.join(', '),
        ),
      );
    }
  }

  // Validate document direction against config
  private async validateDirection(direction: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.SITE_DOCUMENT_DIRECTIONS,
        module: CONFIGURATION_MODULES.SITE,
      },
    });

    if (!config) {
      throw new BadRequestException(SITE_DOCUMENT_ERRORS.DIRECTION_CONFIG_NOT_FOUND);
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validDirections: string[] = [];
    for (const setting of settingsResult.records) {
      if (Array.isArray(setting.value)) {
        validDirections.push(...setting.value.map((v: any) => v.value || v));
      }
    }

    if (!validDirections.map((d) => d.toUpperCase()).includes(direction.toUpperCase())) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_DIRECTION.replace('{direction}', direction).replace(
          '{available}',
          validDirections.join(', '),
        ),
      );
    }
  }

  // Validate document status transitions
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [SiteDocumentStatus.DRAFT]: [SiteDocumentStatus.SUBMITTED, SiteDocumentStatus.APPROVED],
      [SiteDocumentStatus.SUBMITTED]: [SiteDocumentStatus.APPROVED, SiteDocumentStatus.REJECTED],
      [SiteDocumentStatus.APPROVED]: [SiteDocumentStatus.PAID],
      [SiteDocumentStatus.REJECTED]: [SiteDocumentStatus.DRAFT, SiteDocumentStatus.SUBMITTED],
      [SiteDocumentStatus.PAID]: [], // No transitions from PAID
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

  // Validate payment status transitions
  private validatePaymentStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [SiteDocumentPaymentStatus.PENDING]: [
        SiteDocumentPaymentStatus.PARTIAL,
        SiteDocumentPaymentStatus.PAID,
      ],
      [SiteDocumentPaymentStatus.PARTIAL]: [SiteDocumentPaymentStatus.PAID],
      [SiteDocumentPaymentStatus.PAID]: [], // No transitions from PAID (final state)
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        SITE_DOCUMENT_ERRORS.INVALID_PAYMENT_STATUS_TRANSITION.replace(
          '{from}',
          currentStatus,
        ).replace('{to}', newStatus),
      );
    }
  }
}
