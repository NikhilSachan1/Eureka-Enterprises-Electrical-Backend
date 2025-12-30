import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAssetDto, UpdateAssetDto, AssetActionDto, AssetQueryDto } from './dto';
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
} from './constants/asset-masters.constants';
import { BulkDeleteAssetDto } from './dto/bulk-delete-asset.dto';
import { Roles } from '../roles/constants/role.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssetFilesService } from '../asset-files/asset-files.service';
import { AssetEventsService } from '../asset-events/asset-events.service';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { getAssetQuery, getAssetStatsQuery } from './queries/get-asset.query';

@Injectable()
export class AssetMastersService {
  constructor(
    private readonly assetMastersRepository: AssetMastersRepository,
    private readonly assetFilesService: AssetFilesService,
    private readonly assetEventsService: AssetEventsService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly utilityService: UtilityService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

        return assetMaster;
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

    const assetsWithStatus = assets.map((asset) => ({
      ...asset,
      calibrationStatus: this.getCalibrationStatus(asset.assetType, asset.calibrationEndDate),
      warrantyStatus: this.getWarrantyStatus(asset.warrantyEndDate),
    }));

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

  async findOneWithDetails(id: string) {
    try {
      const asset = await this.findOneOrFail({
        where: { id },
        relations: ['assetVersions', 'assetFiles'],
      });

      const activeVersion = await this.assetVersionsService.findOne({
        where: { assetMasterId: id, isActive: true },
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
        ...version,
        files: allFiles.filter((file) => file.assetVersionId === version.id),
      }));

      return {
        id: asset.id,
        assetId: asset.assetId,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
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
}
