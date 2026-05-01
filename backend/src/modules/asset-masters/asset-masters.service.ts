import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateAssetDto,
  UpdateAssetDto,
  AssetActionDto,
  AssetQueryDto,
  MarkLostDto,
  MarkRecoveredDto,
} from './dto';
import { AssetMastersRepository } from './asset-masters.repository';
import { AssetMasterEntity } from './entities/asset-master.entity';
import { DataSource, EntityManager, FindOneOptions, FindOptionsWhere } from 'typeorm';
import {
  ASSET_MASTERS_ERRORS,
  ASSET_MASTERS_SUCCESS_MESSAGES,
  AssetMasterEntityFields,
  AssetEventTypes,
  AssetType,
  AssetStatus,
  AssetFileTypes,
  CalibrationStatus,
  WarrantyStatus,
  EXPIRING_SOON_DAYS,
  ASSET_LOSS_RECOVERY_CATEGORY,
  ASSET_EXPENSE_REFERENCE_TYPES,
  buildLossRecoveryDescription,
  buildRefundDescription,
} from './constants/asset-masters.constants';
import { UserStatus } from '../users/constants/user.constants';
import { BulkDeleteAssetDto } from './dto/bulk-delete-asset.dto';
import { Roles } from '../roles/constants/role.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssetFilesService } from '../asset-files/asset-files.service';
import { AssetEventsService } from '../asset-events/asset-events.service';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { getAssetQuery, getAssetStatsQuery, getLostAssetsQuery } from './queries/get-asset.query';
import { ExpenseTrackerService } from '../expense-tracker/expense-tracker.service';
import { TransactionType } from '../expense-tracker/constants/expense-tracker.constants';
import { WhatsAppService } from '../common/whatsapp/whatsapp.service';
import { EmailService } from '../common/email/email.service';
import { EMAIL_SUBJECT, EMAIL_TEMPLATE } from '../common/email/constants/email.constants';
import { UserService } from '../users/user.service';
import { COMPANY_DETAILS } from 'src/utils/master-constants/master-constants';
import { AssetVersionEntity } from '../asset-versions/entities/asset-versions.entity';
import { UserEntity } from '../users/entities/user.entity';

@Injectable()
export class AssetMastersService {
  private readonly logger = new Logger(AssetMastersService.name);

  constructor(
    private readonly assetMastersRepository: AssetMastersRepository,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetEventsService: AssetEventsService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ExpenseTrackerService))
    private readonly expenseTrackerService: ExpenseTrackerService,
    private readonly whatsAppService: WhatsAppService,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}

  // ==================== Computed Status Methods ====================
  getCalibrationStatus(assetType: string, calibrationEndDate?: Date): CalibrationStatus {
    if (assetType === AssetType.NON_CALIBRATED) {
      return CalibrationStatus.NOT_APPLICABLE;
    }

    if (!calibrationEndDate) {
      return CalibrationStatus.NOT_APPLICABLE;
    }

    const today = new Date();
    const endDate = new Date(calibrationEndDate);
    const daysUntilExpiry = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      return CalibrationStatus.EXPIRED;
    } else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) {
      return CalibrationStatus.EXPIRING_SOON;
    }
    return CalibrationStatus.VALID;
  }

  getWarrantyStatus(warrantyEndDate?: Date): WarrantyStatus {
    if (!warrantyEndDate) {
      return WarrantyStatus.NOT_APPLICABLE;
    }

    const today = new Date();
    const endDate = new Date(warrantyEndDate);
    const daysUntilExpiry = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      return WarrantyStatus.EXPIRED;
    } else if (daysUntilExpiry <= EXPIRING_SOON_DAYS) {
      return WarrantyStatus.EXPIRING_SOON;
    }
    return WarrantyStatus.UNDER_WARRANTY;
  }

  // ==================== Validation Methods ====================
  private validateDates(dto: CreateAssetDto | UpdateAssetDto) {
    // Validate calibration dates not allowed for non-calibrated assets
    if (dto.assetType === AssetType.NON_CALIBRATED) {
      if (
        dto.calibrationStartDate ||
        dto.calibrationEndDate ||
        dto.calibrationFrom ||
        dto.calibrationFrequency
      ) {
        throw new BadRequestException(
          ASSET_MASTERS_ERRORS.CALIBRATION_NOT_ALLOWED_FOR_NON_CALIBRATED,
        );
      }
    }

    // Validate calibration dates
    if (dto.calibrationStartDate && dto.calibrationEndDate) {
      const startDate = new Date(dto.calibrationStartDate);
      const endDate = new Date(dto.calibrationEndDate);
      if (endDate <= startDate) {
        throw new BadRequestException(ASSET_MASTERS_ERRORS.CALIBRATION_END_BEFORE_START);
      }
    }

    // Validate warranty dates
    if (dto.warrantyStartDate && dto.warrantyEndDate) {
      const startDate = new Date(dto.warrantyStartDate);
      const endDate = new Date(dto.warrantyEndDate);
      if (endDate <= startDate) {
        throw new BadRequestException(ASSET_MASTERS_ERRORS.WARRANTY_END_BEFORE_START);
      }
    }
  }

  // ==================== CRUD Methods ====================
  async create(createAssetDto: CreateAssetDto & { createdBy: string }, assetFiles: string[]) {
    try {
      const { assetId, createdBy } = createAssetDto;

      // Check if asset with same ID already exists
      const existingAsset = await this.findOne({ where: { assetId } });
      if (existingAsset) {
        throw new ConflictException(ASSET_MASTERS_ERRORS.ASSET_ALREADY_EXISTS);
      }

      // Validate dates
      this.validateDates(createAssetDto);

      return await this.dataSource.transaction(async (entityManager) => {
        // Create asset master
        const assetMaster = await this.assetMastersRepository.create(
          { assetId, createdBy },
          entityManager,
        );

        // Create initial version
        const initialVersion = await this.assetVersionsService.create(
          {
            ...createAssetDto,
            createdBy,
            assetMasterId: assetMaster.id,
            status: createAssetDto.status || AssetStatus.AVAILABLE,
          },
          entityManager,
        );

        // Create asset added event
        const assetAddedEvent = await this.assetEventsService.create(
          {
            assetMasterId: assetMaster.id,
            eventType: AssetEventTypes.ASSET_ADDED,
            createdBy,
          },
          entityManager,
        );

        // Create available event
        await this.assetEventsService.create(
          {
            assetMasterId: assetMaster.id,
            eventType: AssetEventTypes.AVAILABLE,
            createdBy,
          },
          entityManager,
        );

        // Create asset files if provided - linked to initial version
        if (assetFiles && assetFiles.length > 0) {
          await this.assetFilesService.create(
            {
              assetMasterId: assetMaster.id,
              assetVersionId: initialVersion.id,
              fileType: AssetFileTypes.ASSET_IMAGE,
              fileKeys: assetFiles,
              assetEventsId: assetAddedEvent.id,
              createdBy,
            },
            entityManager,
          );
        }

        return this.utilityService.getSuccessMessage(
          AssetMasterEntityFields.ASSET,
          DataSuccessOperationType.CREATE,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async action(
    assetActionDto: AssetActionDto & { fromUserId: string },
    assetFiles: string[],
    createdBy: string,
  ) {
    try {
      // Validate asset exists
      const asset = await this.findOneOrFail({ where: { id: assetActionDto.assetId } });

      if (!asset) {
        throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
      }

      return await this.assetEventsService.action(
        { ...assetActionDto, assetMasterId: assetActionDto.assetId },
        assetFiles,
        createdBy,
      );
    } catch (error) {
      throw error;
    }
  }

  async findOne(findOptions: FindOneOptions<AssetMasterEntity>) {
    try {
      return await this.assetMastersRepository.findOne(findOptions);
    } catch (error) {
      throw error;
    }
  }

  async findAll(findOptions: AssetQueryDto) {
    const { dataQuery, countQuery, params, countParams } = getAssetQuery(findOptions);
    const statsQuery = getAssetStatsQuery();

    const [assets, totalResult, statsResult] = await Promise.all([
      this.assetMastersRepository.executeRawQuery(dataQuery, params) as Promise<any[]>,
      this.assetMastersRepository.executeRawQuery(countQuery, countParams) as Promise<
        { total: number }[]
      >,
      this.assetMastersRepository.executeRawQuery(statsQuery, []) as Promise<any[]>,
    ]);

    const assetsWithStatus = assets.map((asset) => {
      // Extract and remove flat user fields, then create assignedToUser object
      const {
        assignedToUserId,
        assignedToFirstName,
        assignedToLastName,
        assignedToEmail,
        assignedToEmployeeId,
        ...restAsset
      } = asset;

      return {
        ...restAsset,
        calibrationStatus: this.getCalibrationStatus(asset.assetType, asset.calibrationEndDate),
        warrantyStatus: this.getWarrantyStatus(asset.warrantyEndDate),
        assignedToUser: assignedToUserId
          ? {
              id: assignedToUserId,
              firstName: assignedToFirstName,
              lastName: assignedToLastName,
              email: assignedToEmail,
              employeeId: assignedToEmployeeId,
            }
          : null,
      };
    });

    const stats = statsResult[0] || {};

    return {
      stats: {
        total: Number(stats.total || 0),
        byStatus: {
          available: Number(stats.available || 0),
          assigned: Number(stats.assigned || 0),
          underMaintenance: Number(stats.underMaintenance || 0),
          damaged: Number(stats.damaged || 0),
          retired: Number(stats.retired || 0),
        },
        byAssetType: {
          calibrated: Number(stats.calibrated || 0),
          nonCalibrated: Number(stats.nonCalibrated || 0),
        },
        calibration: {
          valid: Number(stats.calibrationValid || 0),
          expiringSoon: Number(stats.calibrationExpiringSoon || 0),
          expired: Number(stats.calibrationExpired || 0),
        },
        warranty: {
          valid: Number(stats.warrantyValid || 0),
          expiringSoon: Number(stats.warrantyExpiringSoon || 0),
          expired: Number(stats.warrantyExpired || 0),
          notApplicable: Number(stats.warrantyNotApplicable || 0),
        },
      },
      records: assetsWithStatus,
      totalRecords: Number(totalResult[0]?.total || 0),
    };
  }

  async findOneOrFail(findOptions: FindOneOptions<AssetMasterEntity>) {
    try {
      const asset = await this.assetMastersRepository.findOne(findOptions);
      if (!asset) {
        throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
      }
      return asset;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to format user details
  private formatUserDetails(user: any) {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
    };
  }

  async findOneWithDetails(id: string) {
    try {
      const asset = await this.findOneOrFail({
        where: { id },
        relations: [
          'assetVersions',
          'assetVersions.assignedToUser',
          'assetVersions.createdByUser',
          'assetVersions.updatedByUser',
          'assetFiles',
          'createdByUser',
          'updatedByUser',
          'deletedByUser',
        ],
      });

      const activeVersion = await this.assetVersionsService.findOne({
        where: { assetMasterId: id, isActive: true },
        relations: ['assignedToUser', 'createdByUser', 'updatedByUser'],
      });

      if (!activeVersion) {
        throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
      }

      const allFiles = asset.assetFiles?.filter((file) => !file.deletedAt) || [];

      const latestFiles = allFiles
        .filter(
          (file) =>
            file.assetVersionId === activeVersion.id &&
            file.fileType === AssetFileTypes.ASSET_IMAGE,
        )
        .map((file) => ({
          id: file.id,
          fileKey: file.fileKey,
          fileType: file.fileType,
          label: file.label,
        }));

      const versionHistory = (
        asset.assetVersions?.filter((version) => !version.deletedAt) || []
      ).map((version) => ({
        id: version.id,
        assetMasterId: version.assetMasterId,
        name: version.name,
        model: version.model,
        serialNumber: version.serialNumber,
        category: version.category,
        assetType: version.assetType,
        calibrationFrom: version.calibrationFrom,
        calibrationFrequency: version.calibrationFrequency,
        calibrationStartDate: version.calibrationStartDate,
        calibrationEndDate: version.calibrationEndDate,
        purchaseDate: version.purchaseDate,
        vendorName: version.vendorName,
        warrantyStartDate: version.warrantyStartDate,
        warrantyEndDate: version.warrantyEndDate,
        status: version.status,
        assignedTo: version.assignedTo,
        remarks: version.remarks,
        isActive: version.isActive,
        additionalData: version.additionalData,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        createdBy: version.createdBy,
        updatedBy: version.updatedBy,
        // User details for version history
        assignedToUser: this.formatUserDetails(version.assignedToUser),
        createdByUser: this.formatUserDetails(version.createdByUser),
        updatedByUser: this.formatUserDetails(version.updatedByUser),
        files: allFiles.filter((file) => file.assetVersionId === version.id),
      }));

      return {
        id: asset.id,
        assetId: asset.assetId,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        createdBy: asset.createdBy,
        updatedBy: asset.updatedBy,
        deletedBy: asset.deletedBy,
        // User details for asset master
        createdByUser: this.formatUserDetails(asset.createdByUser),
        updatedByUser: this.formatUserDetails(asset.updatedByUser),
        deletedByUser: this.formatUserDetails(asset.deletedByUser),
        // Version details
        name: activeVersion.name,
        model: activeVersion.model,
        serialNumber: activeVersion.serialNumber,
        category: activeVersion.category,
        assetType: activeVersion.assetType,
        // Calibration
        calibrationFrom: activeVersion.calibrationFrom,
        calibrationFrequency: activeVersion.calibrationFrequency,
        calibrationStartDate: activeVersion.calibrationStartDate,
        calibrationEndDate: activeVersion.calibrationEndDate,
        calibrationStatus: this.getCalibrationStatus(
          activeVersion.assetType,
          activeVersion.calibrationEndDate,
        ),
        // Purchase & Warranty
        purchaseDate: activeVersion.purchaseDate,
        vendorName: activeVersion.vendorName,
        warrantyStartDate: activeVersion.warrantyStartDate,
        warrantyEndDate: activeVersion.warrantyEndDate,
        warrantyStatus: this.getWarrantyStatus(activeVersion.warrantyEndDate),
        // Status
        status: activeVersion.status,
        assignedTo: activeVersion.assignedTo,
        // User details for assignedTo
        assignedToUser: this.formatUserDetails(activeVersion.assignedToUser),
        remarks: activeVersion.remarks,
        additionalData: activeVersion.additionalData,
        // Related data - files from latest version only
        files: latestFiles,
        versionHistory,
      };
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    updateData: UpdateAssetDto & { createdBy: string },
    assetFiles: string[] = [],
  ) {
    try {
      const asset = await this.findOneOrFail({ where: identifierConditions });

      // Validate dates
      this.validateDates(updateData);

      const currentVersion = await this.assetVersionsService.findOne({
        where: { assetMasterId: asset.id, isActive: true },
      });

      const toDateString = (date?: Date | string | null): string | undefined => {
        if (!date) return undefined;
        if (typeof date === 'string') return date;
        return date.toISOString().split('T')[0];
      };

      return await this.dataSource.transaction(async (entityManager) => {
        const newVersion = await this.assetVersionsService.create(
          {
            assetMasterId: asset.id,
            name: updateData.name || currentVersion?.name,
            model: updateData.model ?? currentVersion?.model,
            serialNumber: updateData.serialNumber ?? currentVersion?.serialNumber,
            category: updateData.category || currentVersion?.category,
            assetType:
              updateData.assetType ||
              (currentVersion?.assetType as AssetType) ||
              AssetType.NON_CALIBRATED,
            calibrationFrom: updateData.calibrationFrom ?? currentVersion?.calibrationFrom,
            calibrationFrequency:
              updateData.calibrationFrequency ?? currentVersion?.calibrationFrequency,
            calibrationStartDate:
              updateData.calibrationStartDate ?? toDateString(currentVersion?.calibrationStartDate),
            calibrationEndDate:
              updateData.calibrationEndDate ?? toDateString(currentVersion?.calibrationEndDate),
            purchaseDate: updateData.purchaseDate ?? toDateString(currentVersion?.purchaseDate),
            vendorName: updateData.vendorName ?? currentVersion?.vendorName,
            warrantyStartDate:
              updateData.warrantyStartDate ?? toDateString(currentVersion?.warrantyStartDate),
            warrantyEndDate:
              updateData.warrantyEndDate ?? toDateString(currentVersion?.warrantyEndDate),
            status:
              updateData.status || (currentVersion?.status as AssetStatus) || AssetStatus.AVAILABLE,
            assignedTo: updateData.assignedTo ?? currentVersion?.assignedTo,
            remarks: updateData.remarks ?? currentVersion?.remarks,
            additionalData: updateData.additionalData ?? currentVersion?.additionalData,
            createdBy: updateData.createdBy,
          },
          entityManager,
        );

        // Create update event
        const updateEvent = await this.assetEventsService.create(
          {
            assetMasterId: asset.id,
            eventType: AssetEventTypes.UPDATED,
            createdBy: updateData.createdBy,
          },
          entityManager,
        );

        // Create asset files if provided - linked to new version and UPDATED event
        if (assetFiles && assetFiles.length > 0) {
          await this.assetFilesService.create(
            {
              assetMasterId: asset.id,
              assetVersionId: newVersion.id,
              fileType: AssetFileTypes.ASSET_IMAGE,
              fileKeys: assetFiles,
              assetEventsId: updateEvent.id,
              createdBy: updateData.createdBy,
            },
            entityManager,
          );
        }

        return this.utilityService.getSuccessMessage(
          AssetMasterEntityFields.ASSET,
          DataSuccessOperationType.UPDATE,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async delete(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    deletedBy: string,
    entityManager?: EntityManager,
  ) {
    try {
      await this.findOneOrFail({ where: identifierConditions });
      await this.assetMastersRepository.delete(
        { ...identifierConditions, deletedBy },
        entityManager,
      );
      return this.utilityService.getSuccessMessage(
        AssetMasterEntityFields.ASSET,
        DataSuccessOperationType.DELETE,
      );
    } catch (error) {
      throw error;
    }
  }

  async bulkDeleteAssets(bulkDeleteDto: BulkDeleteAssetDto) {
    const { assetIds, deletedBy, userRole } = bulkDeleteDto;
    const result = [];
    const errors = [];

    const isAdminOrHR = userRole === Roles.ADMIN || userRole === Roles.HR;

    for (const assetId of assetIds) {
      try {
        const deletedAsset = await this.validateAndDeleteAsset(assetId, deletedBy, isAdminOrHR);
        result.push(deletedAsset);
      } catch (error) {
        errors.push({
          assetId,
          error: error.message,
        });
      }
    }

    return {
      message: ASSET_MASTERS_SUCCESS_MESSAGES.ASSET_DELETE_PROCESSED.replace(
        '{length}',
        assetIds.length.toString(),
      )
        .replace('{success}', result.length.toString())
        .replace('{error}', errors.length.toString()),
      result,
      errors,
    };
  }

  private async validateAndDeleteAsset(assetId: string, deletedBy: string, isAdminOrHR: boolean) {
    const asset = await this.assetMastersRepository.findOne({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
    }

    if (asset.deletedAt) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.ASSET_ALREADY_DELETED);
    }

    const activeVersion = await this.assetVersionsService.findOne({
      where: { assetMasterId: assetId, isActive: true },
    });

    if (!isAdminOrHR && activeVersion?.status !== AssetStatus.AVAILABLE) {
      throw new BadRequestException(
        ASSET_MASTERS_ERRORS.ASSET_CANNOT_DELETE_ASSIGNED.replace(
          '{status}',
          activeVersion?.status || 'UNKNOWN',
        ),
      );
    }

    await this.assetMastersRepository.delete({ id: assetId, deletedBy });

    return {
      assetId,
      message: ASSET_MASTERS_SUCCESS_MESSAGES.ASSET_DELETE_SUCCESS,
      previousStatus: activeVersion?.status,
    };
  }

  // ==================== LOST / RECOVERED FLOW ====================

  /**
   * Mark an asset as LOST. Admin/HR-only flow.
   * - Validates current status (cannot already be LOST or RETIRED).
   * - Updates asset_versions status to LOST and clears assignedTo.
   * - Creates an assets_events row of type LOST with full metadata.
   * - Attaches uploaded files to that event.
   * - If the asset was assigned and recoveryAmount > 0, charges the previous assignee
   *   via expenseTrackerService.createSystemExpense (DEBIT, category=asset_loss_recovery).
   *   The expense's transactionId is set to the lost event id for traceability.
   * - Fire-and-forget WhatsApp + email notification to the previous assignee.
   */
  async markLost(
    assetMasterId: string,
    dto: MarkLostDto,
    fileKeys: string[] = [],
    actorUserId: string,
  ) {
    const asset = await this.findOneOrFail({ where: { id: assetMasterId } });

    const activeVersion = await this.assetVersionsService.findOne({
      where: { assetMasterId, isActive: true },
    });
    if (!activeVersion) {
      throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
    }

    // Validate state
    if (activeVersion.status === AssetStatus.LOST) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.ASSET_ALREADY_LOST);
    }
    if (activeVersion.status === AssetStatus.RETIRED) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.ASSET_RETIRED_CANNOT_BE_LOST);
    }

    // Block if a handover is pending
    const lastEvent = await this.assetEventsService.findOneEvent({
      where: { assetMasterId },
      order: { createdAt: 'DESC' },
    });
    if (lastEvent?.eventType === AssetEventTypes.HANDOVER_INITIATED) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.PENDING_HANDOVER_BLOCKS_LOST);
    }

    // Validate recovery amount
    const recoveryAmount = Number(dto.recoveryAmount || '0');
    if (Number.isNaN(recoveryAmount) || recoveryAmount < 0) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.RECOVERY_AMOUNT_INVALID);
    }

    const previousAssigneeId = activeVersion.assignedTo || null;
    const purchasePrice = activeVersion.purchasePrice || '0';

    let createdExpenseId: string | null = null;

    await this.dataSource.transaction(async (entityManager: EntityManager) => {
      // 1. Update asset_version: status = LOST, assignedTo = null
      await this.assetVersionsService.update(
        { assetMasterId, isActive: true },
        { status: AssetStatus.LOST, assignedTo: null, updatedBy: actorUserId },
        entityManager,
      );

      // 2. Create LOST event with metadata
      const event = await this.assetEventsService.create(
        {
          assetMasterId,
          eventType: AssetEventTypes.LOST,
          fromUser: previousAssigneeId,
          metadata: {
            reason: dto.reason,
            lastSeenDate: dto.lastSeenDate,
            lastSeenLocation: dto.lastSeenLocation,
            previousAssigneeId,
            recoveryAmount: String(recoveryAmount),
            purchasePriceAtTime: purchasePrice,
          },
          createdBy: actorUserId,
        },
        entityManager,
      );

      // 3. Attach files to event
      if (fileKeys.length > 0) {
        await this.assetFilesService.create(
          {
            assetMasterId,
            assetVersionId: activeVersion.id,
            fileType: AssetFileTypes.OTHER,
            fileKeys,
            assetEventsId: event.id,
            createdBy: actorUserId,
          },
          entityManager,
        );
      }

      // 4. Create expense if there was a previous assignee and amount > 0
      if (previousAssigneeId && recoveryAmount > 0) {
        // Verify the assignee still exists (could be archived — still allowed, just add note)
        const assignee = await entityManager
          .getRepository(UserEntity)
          .findOne({ where: { id: previousAssigneeId } });
        const description = buildLossRecoveryDescription({
          assetName: activeVersion.name,
          serialNumber: activeVersion.serialNumber,
          lastSeenDate: dto.lastSeenDate,
          eventId: event.id,
          employeeArchived: assignee?.status === UserStatus.ARCHIVED,
        });

        const expense = await this.expenseTrackerService.createSystemExpense({
          userId: previousAssigneeId,
          category: ASSET_LOSS_RECOVERY_CATEGORY,
          amount: recoveryAmount,
          description,
          createdBy: actorUserId,
          referenceId: event.id,
          referenceType: ASSET_EXPENSE_REFERENCE_TYPES.ASSET_LOSS,
          transactionType: TransactionType.CREDIT,
        });
        createdExpenseId = expense?.id || null;

        // Update event metadata with expenseId for forward link
        await this.assetEventsService.updateEventMetadata(
          event.id,
          {
            ...(event.metadata || {}),
            reason: dto.reason,
            lastSeenDate: dto.lastSeenDate,
            lastSeenLocation: dto.lastSeenLocation,
            previousAssigneeId,
            recoveryAmount: String(recoveryAmount),
            purchasePriceAtTime: purchasePrice,
            recoveryExpenseId: expense?.id,
          },
          entityManager,
        );
      }
    });

    // Fire-and-forget notifications
    this.sendLostNotifications({
      asset,
      assetVersion: activeVersion,
      previousAssigneeId,
      actorUserId,
      reason: dto.reason,
      lastSeenDate: dto.lastSeenDate,
      lastSeenLocation: dto.lastSeenLocation,
      recoveryAmount: String(recoveryAmount),
    }).catch((err) =>
      this.logger.warn(`Failed to send lost notifications: ${err.message}`),
    );

    return {
      message: ASSET_MASTERS_SUCCESS_MESSAGES.LOST_SUCCESS,
      assetMasterId,
      previousAssigneeId,
      recoveryAmount: String(recoveryAmount),
      recoveryExpenseId: createdExpenseId,
    };
  }

  /**
   * Mark a previously LOST asset as RECOVERED.
   * - Validates current status (must be LOST).
   * - Updates asset_versions status back to AVAILABLE.
   * - Creates an assets_events row of type RECOVERED with notes/files.
   * - If refundRecoveryAmount=true and a recovery expense exists, creates a CREDIT
   *   expense reversing the original debit on the same employee.
   * - Fire-and-forget WhatsApp + email notification to the original assignee.
   */
  async markRecovered(
    assetMasterId: string,
    dto: MarkRecoveredDto,
    fileKeys: string[] = [],
    actorUserId: string,
  ) {
    const asset = await this.findOneOrFail({ where: { id: assetMasterId } });

    const activeVersion = await this.assetVersionsService.findOne({
      where: { assetMasterId, isActive: true },
    });
    if (!activeVersion) {
      throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
    }

    if (activeVersion.status !== AssetStatus.LOST) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.ASSET_NOT_LOST);
    }

    // Find the latest LOST event to extract original assignee + expense ID for refund
    const lastLostEvent = await this.assetEventsService.findOneEvent({
      where: { assetMasterId, eventType: AssetEventTypes.LOST },
      order: { createdAt: 'DESC' },
    });
    if (!lastLostEvent) {
      throw new BadRequestException(ASSET_MASTERS_ERRORS.LOST_EVENT_NOT_FOUND);
    }

    const lostMeta = (lastLostEvent.metadata || {}) as Record<string, any>;
    const originalAssigneeId = lostMeta.previousAssigneeId || lastLostEvent.fromUser || null;
    const originalExpenseId = lostMeta.recoveryExpenseId || null;
    const originalRecoveryAmount = Number(lostMeta.recoveryAmount || '0');

    let refundedAmount = 0;
    let refundExpenseId: string | null = null;

    await this.dataSource.transaction(async (entityManager: EntityManager) => {
      // 1. Update asset_version: status = AVAILABLE
      await this.assetVersionsService.update(
        { assetMasterId, isActive: true },
        { status: AssetStatus.AVAILABLE, assignedTo: null, updatedBy: actorUserId },
        entityManager,
      );

      // 2. Create RECOVERED event
      const recoveredEvent = await this.assetEventsService.create(
        {
          assetMasterId,
          eventType: AssetEventTypes.RECOVERED,
          fromUser: originalAssigneeId, // who had it when it was lost
          metadata: {
            notes: dto.notes,
            lostEventId: lastLostEvent.id,
            previousAssigneeId: originalAssigneeId,
            refundRequested: !!dto.refundRecoveryAmount,
          },
          createdBy: actorUserId,
        },
        entityManager,
      );

      // 3. Attach files to event
      if (fileKeys.length > 0) {
        await this.assetFilesService.create(
          {
            assetMasterId,
            assetVersionId: activeVersion.id,
            fileType: AssetFileTypes.OTHER,
            fileKeys,
            assetEventsId: recoveredEvent.id,
            createdBy: actorUserId,
          },
          entityManager,
        );
      }

      // 4. Refund (if requested)
      if (
        dto.refundRecoveryAmount &&
        originalAssigneeId &&
        originalExpenseId &&
        originalRecoveryAmount > 0
      ) {
        const refundDescription = buildRefundDescription({
          assetName: activeVersion.name,
          serialNumber: activeVersion.serialNumber,
          originalExpenseId,
          recoveredEventId: recoveredEvent.id,
        });

        const refundExpense = await this.expenseTrackerService.createSystemExpense({
          userId: originalAssigneeId,
          category: ASSET_LOSS_RECOVERY_CATEGORY,
          amount: originalRecoveryAmount,
          description: refundDescription,
          createdBy: actorUserId,
          referenceId: recoveredEvent.id,
          referenceType: ASSET_EXPENSE_REFERENCE_TYPES.ASSET_RECOVERY_REFUND,
          transactionType: TransactionType.DEBIT,
        });
        refundExpenseId = refundExpense?.id || null;
        refundedAmount = originalRecoveryAmount;

        // Update RECOVERED event metadata with refund details
        await this.assetEventsService.updateEventMetadata(
          recoveredEvent.id,
          {
            ...(recoveredEvent.metadata || {}),
            notes: dto.notes,
            lostEventId: lastLostEvent.id,
            previousAssigneeId: originalAssigneeId,
            refundRequested: true,
            refundedAmount: String(originalRecoveryAmount),
            refundExpenseId: refundExpense?.id,
          },
          entityManager,
        );
      }
    });

    // Fire-and-forget notifications
    this.sendRecoveredNotifications({
      asset,
      assetVersion: activeVersion,
      previousAssigneeId: originalAssigneeId,
      actorUserId,
      notes: dto.notes,
      refundedAmount: refundedAmount > 0 ? String(refundedAmount) : undefined,
    }).catch((err) =>
      this.logger.warn(`Failed to send recovered notifications: ${err.message}`),
    );

    return {
      message: ASSET_MASTERS_SUCCESS_MESSAGES.RECOVERED_SUCCESS,
      assetMasterId,
      refundedAmount: refundedAmount > 0 ? String(refundedAmount) : null,
      refundExpenseId,
    };
  }

  /**
   * List currently lost assets (status = LOST). Admin view for dashboard.
   */
  async findLost() {
    const records = await this.dataSource.query(getLostAssetsQuery());

    return {
      total: records.length,
      records: records.map((r: any) => ({
        assetMasterId: r.assetMasterId,
        assetId: r.assetId,
        assetVersionId: r.assetVersionId,
        name: r.name,
        model: r.model,
        serialNumber: r.serialNumber,
        category: r.category,
        purchasePrice: r.purchasePrice,
        markedAt: r.markedAt,
        lostMetadata: r.lostMetadata,
        previousAssignee: r.previousAssigneeId
          ? {
              id: r.previousAssigneeId,
              firstName: r.previousAssigneeFirstName,
              lastName: r.previousAssigneeLastName,
              employeeId: r.previousAssigneeEmployeeId,
              email: r.previousAssigneeEmail,
            }
          : null,
        markedBy: r.markedById
          ? {
              id: r.markedById,
              firstName: r.markedByFirstName,
              lastName: r.markedByLastName,
            }
          : null,
        recoveryExpense:
          r.recoveryExpenseId && r.recoveryAmount
            ? { id: r.recoveryExpenseId, amount: r.recoveryAmount }
            : null,
      })),
    };
  }

  // ==================== Notification helpers ====================

  private async sendLostNotifications(input: {
    asset: AssetMasterEntity;
    assetVersion: AssetVersionEntity;
    previousAssigneeId: string | null;
    actorUserId: string;
    reason: string;
    lastSeenDate: string;
    lastSeenLocation: string;
    recoveryAmount: string;
  }): Promise<void> {
    if (!input.previousAssigneeId) return;

    const [recipient, actor] = await Promise.all([
      this.userService.findOne({ id: input.previousAssigneeId }),
      this.userService.findOne({ id: input.actorUserId }),
    ]);
    if (!recipient || !actor) return;

    const employeeName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim();
    const actorName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();

    // Email
    if (recipient.email) {
      try {
        await this.emailService.sendMail({
          receiverEmails: recipient.email,
          subject: EMAIL_SUBJECT.ASSET_LOST.replace('{assetName}', input.assetVersion.name),
          template: EMAIL_TEMPLATE.ASSET_LOST,
          emailData: {
            companyName: COMPANY_DETAILS.NAME,
            currentYear: new Date().getFullYear(),
            employeeName,
            actorName,
            assetId: input.asset.assetId,
            assetName: input.assetVersion.name,
            serialNumber: input.assetVersion.serialNumber,
            reason: input.reason,
            lastSeenDate: input.lastSeenDate,
            lastSeenLocation: input.lastSeenLocation,
            markedOn: new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            recoveryAmount: Number(input.recoveryAmount) > 0 ? input.recoveryAmount : undefined,
          },
        });
      } catch (err) {
        this.logger.warn(`ASSET_LOST email failed: ${err.message}`);
      }
    }

    // WhatsApp
    const whatsappNumber = recipient.whatsappNumber || recipient.contactNumber;
    if (recipient.whatsappOptIn && whatsappNumber) {
      try {
        await this.whatsAppService.sendAssetLost(
          whatsappNumber,
          {
            employeeName,
            assetId: input.asset.assetId,
            assetName: input.assetVersion.name,
            actorName,
            reason: input.reason,
            lastSeenDate: input.lastSeenDate,
            recoveryAmount:
              Number(input.recoveryAmount) > 0 ? input.recoveryAmount : undefined,
          },
          { referenceId: input.asset.id, recipientId: recipient.id },
        );
      } catch (err) {
        this.logger.warn(`ASSET_LOST WhatsApp failed: ${err.message}`);
      }
    }
  }

  private async sendRecoveredNotifications(input: {
    asset: AssetMasterEntity;
    assetVersion: AssetVersionEntity;
    previousAssigneeId: string | null;
    actorUserId: string;
    notes?: string;
    refundedAmount?: string;
  }): Promise<void> {
    if (!input.previousAssigneeId) return;

    const [recipient, actor] = await Promise.all([
      this.userService.findOne({ id: input.previousAssigneeId }),
      this.userService.findOne({ id: input.actorUserId }),
    ]);
    if (!recipient || !actor) return;

    const employeeName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim();
    const actorName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim();

    if (recipient.email) {
      try {
        await this.emailService.sendMail({
          receiverEmails: recipient.email,
          subject: EMAIL_SUBJECT.ASSET_RECOVERED.replace('{assetName}', input.assetVersion.name),
          template: EMAIL_TEMPLATE.ASSET_RECOVERED,
          emailData: {
            companyName: COMPANY_DETAILS.NAME,
            currentYear: new Date().getFullYear(),
            employeeName,
            actorName,
            assetId: input.asset.assetId,
            assetName: input.assetVersion.name,
            serialNumber: input.assetVersion.serialNumber,
            notes: input.notes,
            recoveredOn: new Date().toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            refundedAmount: input.refundedAmount,
          },
        });
      } catch (err) {
        this.logger.warn(`ASSET_RECOVERED email failed: ${err.message}`);
      }
    }

    const whatsappNumber = recipient.whatsappNumber || recipient.contactNumber;
    if (recipient.whatsappOptIn && whatsappNumber) {
      try {
        await this.whatsAppService.sendAssetRecovered(
          whatsappNumber,
          {
            employeeName,
            assetId: input.asset.assetId,
            assetName: input.assetVersion.name,
            actorName,
            notes: input.notes,
            refundedAmount: input.refundedAmount,
          },
          { referenceId: input.asset.id, recipientId: recipient.id },
        );
      } catch (err) {
        this.logger.warn(`ASSET_RECOVERED WhatsApp failed: ${err.message}`);
      }
    }
  }
}

