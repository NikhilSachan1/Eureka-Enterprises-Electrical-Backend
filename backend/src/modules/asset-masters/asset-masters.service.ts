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
  AssetMasterEntityFields,
  AssetEventTypes,
  AssetType,
  AssetStatus,
  AssetFileTypes,
  CalibrationStatus,
  WarrantyStatus,
  EXPIRING_SOON_DAYS,
} from './constants/asset-masters.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DataSuccessOperationType } from 'src/utils/utility/constants/utility.constants';
import { InjectDataSource } from '@nestjs/typeorm';
import { AssetFilesService } from '../asset-files/asset-files.service';
import { AssetEventsService } from '../asset-events/asset-events.service';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { getAssetQuery } from './queries/get-asset.query';

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
        await this.assetVersionsService.create(
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

        // Create asset files if provided
        if (assetFiles && assetFiles.length > 0) {
          await this.assetFilesService.create(
            {
              assetMasterId: assetMaster.id,
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
    try {
      const { dataQuery, countQuery, params, countParams } = getAssetQuery(findOptions);
      const [assets, total] = await Promise.all([
        this.assetMastersRepository.executeRawQuery(dataQuery, params) as Promise<any[]>,
        this.assetMastersRepository.executeRawQuery(countQuery, countParams) as Promise<{
          total: number;
        }>,
      ]);

      // Add computed statuses to each asset
      const assetsWithStatus = assets.map((asset) => ({
        ...asset,
        calibrationStatus: this.getCalibrationStatus(asset.assetType, asset.calibrationEndDate),
        warrantyStatus: this.getWarrantyStatus(asset.warrantyEndDate),
      }));

      return this.utilityService.listResponse(assetsWithStatus, total[0].total);
    } catch (error) {
      throw error;
    }
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
        relations: ['assetVersions', 'assetFiles', 'assetEvents'],
      });

      const activeVersion = await this.assetVersionsService.findActiveVersion(id);

      if (!activeVersion) {
        throw new NotFoundException(ASSET_MASTERS_ERRORS.ASSET_NOT_FOUND);
      }

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
        // Related data
        files: asset.assetFiles?.filter((f) => !f.deletedAt) || [],
        events: asset.assetEvents?.filter((e) => !e.deletedAt) || [],
        versionHistory: asset.assetVersions?.filter((v) => !v.deletedAt) || [],
      };
    } catch (error) {
      throw error;
    }
  }

  async update(
    identifierConditions: FindOptionsWhere<AssetMasterEntity>,
    updateData: UpdateAssetDto & { createdBy: string },
    entityManager?: EntityManager,
  ) {
    try {
      const asset = await this.findOneOrFail({ where: identifierConditions });

      // Validate dates
      this.validateDates(updateData);

      // Get current active version to merge with updates
      const currentVersion = await this.assetVersionsService.findActiveVersion(asset.id);

      // Helper to convert Date to ISO string
      const toDateString = (date?: Date | string | null): string | undefined => {
        if (!date) return undefined;
        if (typeof date === 'string') return date;
        return date.toISOString().split('T')[0];
      };

      // Create new version with merged data
      await this.assetVersionsService.create(
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
      await this.assetEventsService.create(
        {
          assetMasterId: asset.id,
          eventType: AssetEventTypes.UPDATED,
          createdBy: updateData.createdBy,
        },
        entityManager,
      );

      return this.utilityService.getSuccessMessage(
        AssetMasterEntityFields.ASSET,
        DataSuccessOperationType.UPDATE,
      );
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
}
