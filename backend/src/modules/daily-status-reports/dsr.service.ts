import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { IsNull, Between, MoreThanOrEqual, LessThanOrEqual, FindOneOptions } from 'typeorm';
import { DsrRepository } from './dsr.repository';
import { DailyStatusReportEntity, DsrFileEntity, DsrEditHistoryEntity } from './entities';
import { CreateDsrDto, ForceCreateDsrDto, UpdateDsrDto, GetDsrDto } from './dto';
import {
  DSR_ERRORS,
  DSR_RESPONSES,
  DsrEntityFields,
  DSR_DEFAULT_STATUS,
  DsrEntryType,
} from './constants/dsr.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import {
  SortOrder,
  DefaultPaginationValues,
  DataSuccessOperationType,
} from 'src/utils/utility/constants/utility.constants';
import { SiteAllocationRepository } from '../site-allocations/site-allocation.repository';
import { SiteService } from '../sites/site.service';
import { SiteStatus } from '../sites/constants/site.constants';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { SYSTEM_USER_ID } from '../users/constants/user.constants';
import { AssetVersionsService } from '../asset-versions/asset-versions.service';
import { Roles } from '../roles/constants/role.constants';

@Injectable()
export class DsrService {
  constructor(
    private readonly dsrRepository: DsrRepository,
    private readonly siteAllocationRepository: SiteAllocationRepository,
    private readonly siteService: SiteService,
    private readonly assetVersionsService: AssetVersionsService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
  ) {}

  async create(createDto: CreateDsrDto, userId: string, fileKeys: string[] = []) {
    // Validate site exists and is in valid status
    const site = await this.siteService.findOneOrFail({
      where: { id: createDto.siteId, deletedAt: IsNull() },
    });

    if (![SiteStatus.UPCOMING, SiteStatus.ONGOING].includes(site.status as SiteStatus)) {
      throw new BadRequestException(DSR_ERRORS.SITE_NOT_ACTIVE);
    }

    // Validate user is allocated to the site
    const allocation = await this.siteAllocationRepository.findOne({
      where: {
        siteId: createDto.siteId,
        userId,
        isCurrentlyAllocated: true,
        deletedAt: IsNull(),
      },
    });

    if (!allocation) {
      throw new BadRequestException(DSR_ERRORS.SITE_NOT_ALLOCATED);
    }

    // Check if active DSR already exists for this site, user, and date
    const existingDsr = await this.dsrRepository.findOne({
      where: {
        siteId: createDto.siteId,
        userId,
        reportDate: new Date(createDto.reportDate),
        isActive: true,
        deletedAt: IsNull(),
      },
    });

    if (existingDsr) {
      throw new ConflictException(DSR_ERRORS.ALREADY_EXISTS);
    }

    // Validate work types if provided
    if (createDto.workTypes?.length) {
      await this.validateWorkTypes(createDto.workTypes);
    }

    // Validate weather condition if provided
    if (createDto.weatherCondition) {
      await this.validateWeatherCondition(createDto.weatherCondition);
    }

    // Validate equipment if provided
    if (createDto.equipmentUsed?.length) {
      await this.validateEquipment(createDto.equipmentUsed, userId);
    }

    // Get hours worked from shift config
    const hoursWorked = await this.getShiftHours();

    // Create DSR with auto-approval
    const dsrData: Partial<DailyStatusReportEntity> = {
      siteId: createDto.siteId,
      userId,
      reportDate: new Date(createDto.reportDate),
      workTypes: createDto.workTypes || null,
      workDescription: createDto.workDescription || null,
      hoursWorked,
      challenges: createDto.challenges || null,
      reportingEngineerName: createDto.reportingEngineerName || null,
      reportingEngineerContact: createDto.reportingEngineerContact || null,
      weatherCondition: createDto.weatherCondition || null,
      manpowerCount: createDto.manpowerCount || null,
      equipmentUsed: createDto.equipmentUsed || null,
      remarks: createDto.remarks || null,
      dsrEntryType: DsrEntryType.SELF,
      // Auto-approval
      status: DSR_DEFAULT_STATUS,
      approvedBy: SYSTEM_USER_ID,
      approvedAt: new Date(),
      createdBy: userId,
      // Versioning fields
      isActive: true,
      versionNumber: 1,
      originalDsrId: null,
      parentDsrId: null,
      editReason: null,
    };

    const dsr = await this.dsrRepository.create(dsrData);

    // Create file records if files were uploaded
    if (fileKeys.length > 0) {
      for (const fileKey of fileKeys) {
        await this.dsrRepository.createFile({
          dsrId: dsr.id,
          fileKey,
          fileName: fileKey.split('/').pop() || 'file',
          fileType: this.getFileTypeFromKey(fileKey),
          createdBy: userId,
        });
      }
    }

    return this.utilityService.getSuccessMessage(
      DsrEntityFields.DSR,
      DataSuccessOperationType.CREATE,
    );
  }

  /**
   * Create DSR without requiring site allocation to the target user.
   * Optional userId (defaults to creator); only privileged roles may set another user.
   * Equipment list is validated for existence only (not assignment to the user).
   */
  async forceCreate(
    createDto: ForceCreateDsrDto,
    actingUserId: string,
    actingUserRole: string,
    fileKeys: string[] = [],
  ) {
    const { userId: bodyUserId, ...rest } = createDto;
    const targetUserId = bodyUserId ?? actingUserId;

    if (targetUserId !== actingUserId) {
      const allowedRoles = [Roles.SUPER_ADMIN, Roles.HR, Roles.ADMIN, Roles.MANAGER];
      if (!allowedRoles.includes(actingUserRole as Roles)) {
        throw new ForbiddenException(DSR_ERRORS.FORCE_TARGET_USER_FORBIDDEN);
      }
    }

    const site = await this.siteService.findOneOrFail({
      where: { id: createDto.siteId, deletedAt: IsNull() },
    });

    if (![SiteStatus.UPCOMING, SiteStatus.ONGOING].includes(site.status as SiteStatus)) {
      throw new BadRequestException(DSR_ERRORS.SITE_NOT_ACTIVE);
    }

    const existingDsr = await this.dsrRepository.findOne({
      where: {
        siteId: createDto.siteId,
        userId: targetUserId,
        reportDate: new Date(createDto.reportDate),
        isActive: true,
        deletedAt: IsNull(),
      },
    });

    if (existingDsr) {
      throw new ConflictException(DSR_ERRORS.ALREADY_EXISTS);
    }

    if (rest.workTypes?.length) {
      await this.validateWorkTypes(rest.workTypes);
    }
    if (rest.weatherCondition) {
      await this.validateWeatherCondition(rest.weatherCondition);
    }
    if (rest.equipmentUsed?.length) {
      await this.validateEquipmentExists(rest.equipmentUsed);
    }

    const hoursWorked = await this.getShiftHours();

    const dsrData: Partial<DailyStatusReportEntity> = {
      siteId: createDto.siteId,
      userId: targetUserId,
      reportDate: new Date(createDto.reportDate),
      workTypes: rest.workTypes || null,
      workDescription: rest.workDescription || null,
      hoursWorked,
      challenges: rest.challenges || null,
      reportingEngineerName: rest.reportingEngineerName || null,
      reportingEngineerContact: rest.reportingEngineerContact || null,
      weatherCondition: rest.weatherCondition || null,
      manpowerCount: rest.manpowerCount ?? null,
      equipmentUsed: rest.equipmentUsed || null,
      remarks: rest.remarks || null,
      dsrEntryType: DsrEntryType.FORCED,
      status: DSR_DEFAULT_STATUS,
      approvedBy: SYSTEM_USER_ID,
      approvedAt: new Date(),
      createdBy: actingUserId,
      isActive: true,
      versionNumber: 1,
      originalDsrId: null,
      parentDsrId: null,
      editReason: null,
    };

    const dsr = await this.dsrRepository.create(dsrData);

    if (fileKeys.length > 0) {
      for (const fileKey of fileKeys) {
        await this.dsrRepository.createFile({
          dsrId: dsr.id,
          fileKey,
          fileName: fileKey.split('/').pop() || 'file',
          fileType: this.getFileTypeFromKey(fileKey),
          createdBy: actingUserId,
        });
      }
    }

    return this.utilityService.getSuccessMessage(
      DsrEntityFields.DSR,
      DataSuccessOperationType.CREATE,
    );
  }

  async findAll(options: GetDsrDto) {
    const {
      siteId,
      userId,
      status,
      weatherCondition,
      reportDateFrom,
      reportDateTo,
      includeSite,
      includeUser,
      includeFiles,
      includeEditHistory,
      sortField = DefaultPaginationValues.SORT_FIELD,
      sortOrder = DefaultPaginationValues.SORT_ORDER,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    const where: any = {
      deletedAt: IsNull(),
      isActive: true,
    };

    if (siteId) where.siteId = siteId;
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (weatherCondition) where.weatherCondition = weatherCondition;

    // Date range filters
    if (reportDateFrom && reportDateTo) {
      where.reportDate = Between(new Date(reportDateFrom), new Date(reportDateTo));
    } else if (reportDateFrom) {
      where.reportDate = MoreThanOrEqual(new Date(reportDateFrom));
    } else if (reportDateTo) {
      where.reportDate = LessThanOrEqual(new Date(reportDateTo));
    }

    const relations: string[] = ['createdByUser'];
    if (includeSite) relations.push('site');
    if (includeUser) relations.push('user');
    if (includeFiles) relations.push('files');
    if (includeEditHistory) relations.push('editHistory');

    const records = await this.dsrRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalRecords = await this.dsrRepository.count({ where });

    return this.utilityService.listResponse(
      records.map((record) => ({
        ...record,
        site: record.site ? { id: record.site.id, name: record.site.name } : null,
        user: record.user
          ? {
              id: record.user.id,
              firstName: record.user.firstName,
              lastName: record.user.lastName,
              email: record.user.email,
              employeeId: record.user.employeeId,
            }
          : null,
        createdByUser: record.createdByUser
          ? {
              id: record.createdByUser.id,
              firstName: record.createdByUser.firstName,
              lastName: record.createdByUser.lastName,
              email: record.createdByUser.email,
              employeeId: record.createdByUser.employeeId,
            }
          : null,
        files: record.files
          ? record.files
              .filter((file) => !file.deletedAt)
              .map((file) => ({
                id: file.id,
                fileKey: file.fileKey,
                fileName: file.fileName,
                fileType: file.fileType,
              }))
          : [],
        editHistory: record.editHistory
          ? record.editHistory
              .filter((history) => !history.deletedAt)
              .map((history) => ({
                id: history.id,
                editedBy: history.editedBy,
                editedAt: history.editedAt,
                previousValues: history.previousValues,
                newValues: history.newValues,
                changeReason: history.changeReason,
              }))
          : [],
      })),
      totalRecords,
    );
  }

  async findOne(options: FindOneOptions<DailyStatusReportEntity>) {
    return await this.dsrRepository.findOne(options);
  }

  async findOneOrFail(
    options: FindOneOptions<DailyStatusReportEntity>,
  ): Promise<DailyStatusReportEntity> {
    const dsr = await this.dsrRepository.findOne(options);
    if (!dsr) {
      throw new NotFoundException(DSR_ERRORS.NOT_FOUND);
    }
    return dsr;
  }

  async findById(id: string, includeRelations = true) {
    const relations = includeRelations
      ? ['site', 'user', 'files', 'editHistory', 'createdByUser', 'updatedByUser']
      : [];
    const record = await this.findOneOrFail({
      where: { id },
      relations,
    });

    // Transform response to include all necessary information
    return {
      ...record,
      site: record.site ? { id: record.site.id, name: record.site.name } : null,
      user: record.user
        ? {
            id: record.user.id,
            firstName: record.user.firstName,
            lastName: record.user.lastName,
            email: record.user.email,
            employeeId: record.user.employeeId,
          }
        : null,
      createdByUser: record.createdByUser
        ? {
            id: record.createdByUser.id,
            firstName: record.createdByUser.firstName,
            lastName: record.createdByUser.lastName,
            email: record.createdByUser.email,
            employeeId: record.createdByUser.employeeId,
          }
        : null,
      updatedByUser: record.updatedByUser
        ? {
            id: record.updatedByUser.id,
            firstName: record.updatedByUser.firstName,
            lastName: record.updatedByUser.lastName,
            email: record.updatedByUser.email,
            employeeId: record.updatedByUser.employeeId,
          }
        : null,
      files: record.files
        ? record.files
            .filter((file) => !file.deletedAt)
            .map((file) => ({
              id: file.id,
              fileKey: file.fileKey,
              fileName: file.fileName,
              fileType: file.fileType,
            }))
        : [],
      editHistory: record.editHistory
        ? record.editHistory
            .filter((history) => !history.deletedAt)
            .map((history) => ({
              id: history.id,
              editedBy: history.editedBy,
              editedAt: history.editedAt,
              previousValues: history.previousValues,
              newValues: history.newValues,
              changeReason: history.changeReason,
            }))
        : [],
      // Versioning info
      versionInfo: {
        versionNumber: record.versionNumber || 1,
        isActive: record.isActive ?? true,
        originalDsrId: record.originalDsrId,
        parentDsrId: record.parentDsrId,
        editReason: record.editReason,
      },
    };
  }

  async update(id: string, updateDto: UpdateDsrDto, updatedBy: string, fileKeys: string[] = []) {
    const existingDsr = await this.findOneOrFail({
      where: { id, isActive: true },
      relations: ['files'],
    });

    // Check edit cutoff from config
    await this.checkEditCutoff(existingDsr);

    // Validate work types if provided
    if (updateDto.workTypes?.length) {
      await this.validateWorkTypes(updateDto.workTypes);
    }

    // Validate weather condition if provided
    if (updateDto.weatherCondition) {
      await this.validateWeatherCondition(updateDto.weatherCondition);
    }

    // Validate equipment if provided
    if (updateDto.equipmentUsed?.length) {
      await this.validateEquipment(updateDto.equipmentUsed, existingDsr.userId);
    }

    // Remove fields that shouldn't be directly updated
    const { changeReason, ...updateFields } = updateDto;
    delete (updateFields as any).dsrFiles;

    // Mark old DSR as inactive (versioning approach like expense tracker)
    await this.dsrRepository.update({ id }, { isActive: false, updatedBy });

    // Prepare data for new version
    const originalDsrId = existingDsr.originalDsrId || existingDsr.id;
    const parentDsrId = existingDsr.id;
    const versionNumber = (existingDsr.versionNumber || 1) + 1;

    // Create new DSR version with updated data (only copy relevant fields)
    const newDsr = await this.dsrRepository.create({
      // Core fields from existing DSR
      siteId: existingDsr.siteId,
      userId: existingDsr.userId,
      reportDate: existingDsr.reportDate,
      dsrEntryType: existingDsr.dsrEntryType ?? DsrEntryType.SELF,
      workTypes: existingDsr.workTypes,
      workDescription: existingDsr.workDescription,
      hoursWorked: existingDsr.hoursWorked,
      challenges: existingDsr.challenges,
      reportingEngineerName: existingDsr.reportingEngineerName,
      reportingEngineerContact: existingDsr.reportingEngineerContact,
      weatherCondition: existingDsr.weatherCondition,
      manpowerCount: existingDsr.manpowerCount,
      equipmentUsed: existingDsr.equipmentUsed,
      status: existingDsr.status,
      approvedBy: existingDsr.approvedBy,
      approvedAt: existingDsr.approvedAt,
      remarks: existingDsr.remarks,
      // Override with updated fields
      ...updateFields,
      // Versioning fields
      isActive: true,
      originalDsrId,
      parentDsrId,
      versionNumber,
      editReason: changeReason || null,
      createdBy: existingDsr.createdBy,
      updatedBy,
    });

    // Handle files - create new file records for the new DSR version
    if (fileKeys.length > 0) {
      // Add new files to the new DSR version
      for (const fileKey of fileKeys) {
        await this.dsrRepository.createFile({
          dsrId: newDsr.id,
          fileKey,
          fileName: fileKey.split('/').pop() || 'file',
          fileType: this.getFileTypeFromKey(fileKey),
          createdBy: updatedBy,
        });
      }
    } else if (existingDsr.files?.length) {
      // Copy existing files to new version if no new files provided
      for (const file of existingDsr.files.filter((f) => !f.deletedAt)) {
        await this.dsrRepository.createFile({
          dsrId: newDsr.id,
          fileKey: file.fileKey,
          fileName: file.fileName,
          fileType: file.fileType,
          createdBy: updatedBy,
        });
      }
    }

    return this.utilityService.getSuccessMessage(
      DsrEntityFields.DSR,
      DataSuccessOperationType.UPDATE,
    );
  }

  async remove(id: string, deletedBy: string) {
    await this.findOneOrFail({ where: { id, isActive: true } });
    await this.dsrRepository.update({ id }, { deletedBy });
    await this.dsrRepository.softDelete({ id });
    return this.utilityService.getSuccessMessage(
      DsrEntityFields.DSR,
      DataSuccessOperationType.DELETE,
    );
  }

  async restore(id: string) {
    const dsr = await this.dsrRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!dsr) {
      throw new NotFoundException(DSR_ERRORS.NOT_FOUND);
    }

    await this.dsrRepository.restore({ id });
    await this.dsrRepository.update({ id }, { deletedBy: null });

    const restoredDsr = await this.findById(id);
    return {
      message: DSR_RESPONSES.RESTORED,
      data: restoredDsr,
    };
  }

  // Get DSRs by site
  async getDsrsBySite(siteId: string, options?: Partial<GetDsrDto>) {
    await this.siteService.findOneOrFail({ where: { id: siteId, deletedAt: IsNull() } });
    return this.findAll({ ...options, siteId } as GetDsrDto);
  }

  // Get DSRs by user
  async getDsrsByUser(userId: string, options?: Partial<GetDsrDto>) {
    return this.findAll({ ...options, userId } as GetDsrDto);
  }

  // Get edit history for a DSR
  async getEditHistory(dsrId: string): Promise<DsrEditHistoryEntity[]> {
    await this.findOneOrFail({ where: { id: dsrId } });
    return await this.dsrRepository.findEditHistory({
      where: { dsrId },
      relations: ['editedByUser'],
      order: { editedAt: 'DESC' },
    });
  }

  // Get version history for a DSR (all versions including current and previous)
  async getVersionHistory(dsrId: string) {
    const currentDsr = await this.findOneOrFail({ where: { id: dsrId } });

    // Get the original DSR ID (first version)
    const originalId = currentDsr.originalDsrId || currentDsr.id;

    // Find all versions (both active and inactive) that share the same original ID
    const versions = await this.dsrRepository.findAll({
      where: [{ id: originalId }, { originalDsrId: originalId }],
      relations: ['files', 'createdByUser', 'updatedByUser'],
      order: { versionNumber: 'DESC' },
    });

    return versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      isActive: version.isActive,
      dsrEntryType: version.dsrEntryType ?? DsrEntryType.SELF,
      editReason: version.editReason,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      createdBy: version.createdByUser
        ? {
            id: version.createdByUser.id,
            firstName: version.createdByUser.firstName,
            lastName: version.createdByUser.lastName,
          }
        : null,
      updatedBy: version.updatedByUser
        ? {
            id: version.updatedByUser.id,
            firstName: version.updatedByUser.firstName,
            lastName: version.updatedByUser.lastName,
          }
        : null,
      // Include key fields for comparison
      workTypes: version.workTypes,
      workDescription: version.workDescription,
      challenges: version.challenges,
      weatherCondition: version.weatherCondition,
      manpowerCount: version.manpowerCount,
      hoursWorked: version.hoursWorked,
      remarks: version.remarks,
      files:
        version.files
          ?.filter((f) => !f.deletedAt)
          .map((f) => ({
            id: f.id,
            fileKey: f.fileKey,
            fileName: f.fileName,
            fileType: f.fileType,
          })) || [],
    }));
  }

  // Get files for a DSR
  async getFiles(dsrId: string): Promise<DsrFileEntity[]> {
    await this.findOneOrFail({ where: { id: dsrId } });
    return await this.dsrRepository.findAllFiles({
      where: { dsrId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async removeFile(fileId: string) {
    const file = await this.dsrRepository.findFileOne({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException(DSR_ERRORS.FILE_NOT_FOUND);
    }

    await this.dsrRepository.softDeleteFile({ id: fileId });
    return { message: DSR_RESPONSES.FILE_DELETED };
  }

  // Helper to determine file type from file key/extension
  private getFileTypeFromKey(fileKey: string): string {
    const extension = fileKey.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      return 'IMAGE';
    } else if (extension === 'pdf') {
      return 'PDF';
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) {
      return 'VIDEO';
    }
    return 'IMAGE'; // Default
  }

  // Validation helpers
  private async validateWorkTypes(workTypes: string[]): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SITE_WORK_TYPES, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(
        DSR_ERRORS.INVALID_WORK_TYPE.replace('{type}', workTypes.join(', ')).replace(
          '{available}',
          'Configuration not found',
        ),
      );
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

    for (const workType of workTypes) {
      if (!validTypes.includes(workType)) {
        throw new BadRequestException(
          DSR_ERRORS.INVALID_WORK_TYPE.replace('{type}', workType).replace(
            '{available}',
            validTypes.join(', '),
          ),
        );
      }
    }
  }

  private async validateWeatherCondition(condition: string): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.DSR_WEATHER_CONDITIONS, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      throw new BadRequestException(DSR_ERRORS.WEATHER_CONFIG_NOT_FOUND);
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    const validConditions: string[] = [];
    for (const setting of settingsResult.records) {
      if (Array.isArray(setting.value)) {
        validConditions.push(...setting.value.map((v: any) => v.value || v));
      }
    }

    if (!validConditions.map((c) => c.toUpperCase()).includes(condition.toUpperCase())) {
      throw new BadRequestException(
        DSR_ERRORS.INVALID_WEATHER_CONDITION.replace('{condition}', condition).replace(
          '{available}',
          validConditions.join(', '),
        ),
      );
    }
  }

  private async validateEquipment(assetVersionIds: string[], userId: string): Promise<void> {
    for (const assetVersionId of assetVersionIds) {
      const asset = await this.assetVersionsService.findOne({
        where: {
          id: assetVersionId,
          assignedTo: userId,
          deletedAt: IsNull(),
        },
      });

      if (!asset) {
        throw new BadRequestException(
          DSR_ERRORS.EQUIPMENT_NOT_ALLOCATED.replace('{assetId}', assetVersionId),
        );
      }
    }
  }

  private async validateEquipmentExists(assetVersionIds: string[]): Promise<void> {
    for (const assetVersionId of assetVersionIds) {
      const asset = await this.assetVersionsService.findOne({
        where: {
          id: assetVersionId,
          deletedAt: IsNull(),
        },
      });

      if (!asset) {
        throw new BadRequestException(
          DSR_ERRORS.EQUIPMENT_NOT_ALLOCATED.replace('{assetId}', assetVersionId),
        );
      }
    }
  }

  private async getShiftHours(): Promise<number> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.SHIFT_CONFIGS, module: CONFIGURATION_MODULES.ATTENDANCE },
    });

    if (!config) {
      throw new BadRequestException(DSR_ERRORS.SHIFT_CONFIG_NOT_FOUND);
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    for (const setting of settingsResult.records) {
      if (setting.value && typeof setting.value === 'object') {
        const { startTime, endTime, breakMinutes } = setting.value;

        if (startTime && endTime) {
          // Parse times (format: "HH:mm")
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);

          // Calculate total minutes
          const startTotalMinutes = startHour * 60 + startMin;
          let endTotalMinutes = endHour * 60 + endMin;

          // Handle overnight shifts (end time is less than start time)
          if (endTotalMinutes < startTotalMinutes) {
            endTotalMinutes += 24 * 60; // Add 24 hours
          }

          let shiftMinutes = endTotalMinutes - startTotalMinutes;

          // Subtract break time if configured
          if (breakMinutes && typeof breakMinutes === 'number') {
            shiftMinutes -= breakMinutes;
          }

          // Convert to hours with 2 decimal precision
          return Math.round((shiftMinutes / 60) * 100) / 100;
        }
      }
    }

    throw new BadRequestException(DSR_ERRORS.SHIFT_CONFIG_NOT_FOUND);
  }

  private async checkEditCutoff(dsr: DailyStatusReportEntity): Promise<void> {
    const config = await this.configurationService.findOne({
      where: { key: CONFIGURATION_KEYS.DSR_EDIT_CUTOFF, module: CONFIGURATION_MODULES.SITE },
    });

    if (!config) {
      // No config means no cutoff restriction
      return;
    }

    const settingsResult = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    let cutoffMs: number | null = null;
    let cutoffDisplay = '';

    for (const setting of settingsResult.records) {
      if (setting.value && typeof setting.value === 'object') {
        const { value, unit } = setting.value;

        if (value !== null && value !== undefined && unit) {
          const numValue = Number(value);

          // Convert to milliseconds based on unit
          switch (unit) {
            case 'minutes':
              cutoffMs = numValue * 60 * 1000;
              cutoffDisplay = `${numValue} minute(s)`;
              break;
            case 'hours':
              cutoffMs = numValue * 60 * 60 * 1000;
              cutoffDisplay = `${numValue} hour(s)`;
              break;
            case 'days':
              cutoffMs = numValue * 24 * 60 * 60 * 1000;
              cutoffDisplay = `${numValue} day(s)`;
              break;
            default:
              // Default to hours if unit not recognized
              cutoffMs = numValue * 60 * 60 * 1000;
              cutoffDisplay = `${numValue} hour(s)`;
          }
        }
      }
    }

    if (cutoffMs === null) {
      return;
    }

    const createdAt = new Date(dsr.createdAt);
    const now = new Date();
    const timeSinceCreation = now.getTime() - createdAt.getTime();

    if (timeSinceCreation > cutoffMs) {
      throw new BadRequestException(
        DSR_ERRORS.EDIT_CUTOFF_EXCEEDED.replace('{duration}', cutoffDisplay),
      );
    }
  }
}
