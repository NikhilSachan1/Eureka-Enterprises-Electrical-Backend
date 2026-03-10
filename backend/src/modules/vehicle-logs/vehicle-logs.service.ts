import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IsNull,
  FindOneOptions,
  LessThanOrEqual,
  MoreThanOrEqual,
  Or,
  Between,
  LessThan,
  MoreThan,
  FindOptionsWhere,
} from 'typeorm';
import { VehicleLogsRepository } from './vehicle-logs.repository';
import { VehicleLogEntity } from './entities/vehicle-log.entity';
import { VehicleLogFileEntity } from './entities/vehicle-log-file.entity';
import { CreateVehicleLogDto, UpdateVehicleLogDto, GetVehicleLogDto } from './dto';
import {
  VEHICLE_LOG_ERRORS,
  VEHICLE_LOG_RESPONSES,
  VEHICLE_LOG_ANOMALY_REASON,
  VehicleLogFileType,
  VehicleLogStatus,
} from './constants/vehicle-logs.constants';
import { UtilityService } from 'src/utils/utility/utility.service';
import { DateTimeService } from 'src/utils/datetime/datetime.service';
import { VehicleVersionsService } from '../vehicle-versions/vehicle-versions.service';
import { SiteAllocationService } from '../site-allocations/site-allocation.service';
import { SiteService } from '../sites/site.service';
import { ConfigurationService } from '../configurations/configuration.service';
import { ConfigSettingService } from '../config-settings/config-setting.service';
import {
  CONFIGURATION_KEYS,
  CONFIGURATION_MODULES,
} from 'src/utils/master-constants/master-constants';
import { SortOrder, DefaultPaginationValues } from 'src/utils/utility/constants/utility.constants';
import { Roles } from '../roles/constants/role.constants';
import { VEHICLE_LOG_SORTABLE_FIELDS } from './constants/vehicle-logs.constants';
@Injectable()
export class VehicleLogsService {
  constructor(
    private readonly vehicleLogsRepository: VehicleLogsRepository,
    private readonly vehicleVersionsService: VehicleVersionsService,
    private readonly siteAllocationService: SiteAllocationService,
    private readonly siteService: SiteService,
    private readonly configurationService: ConfigurationService,
    private readonly configSettingService: ConfigSettingService,
    private readonly utilityService: UtilityService,
    private readonly dateTimeService: DateTimeService,
  ) {}

  async create(
    createDto: CreateVehicleLogDto,
    userId: string,
    userRole: string,
    fileData: {
      startOdometerFiles?: string[];
      endOdometerFiles?: string[];
      otherFiles?: string[];
    } = {},
    timezone?: string,
  ) {
    // Use DateTimeService for timezone-aware date handling
    const tz = this.dateTimeService.getSafeTimezone(timezone);
    const logDateStr = createDto.logDate; // YYYY-MM-DD string
    const logDate = this.dateTimeService.toDate(logDateStr);

    // Validate log date is not in future (timezone-aware)
    if (this.dateTimeService.isFutureDate(logDateStr, tz)) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.FUTURE_DATE_NOT_ALLOWED);
    }

    // Check backfill permission (timezone-aware)
    await this.checkBackfillPermission(logDateStr, userRole, tz);

    // Get vehicleId and driverId
    const { vehicleId, driverId } = await this.resolveVehicleAndDriver(createDto.vehicleId, userId);

    // Check for duplicate log (same vehicle, same date)
    const existingLog = await this.vehicleLogsRepository.findOne({
      where: {
        vehicleId,
        logDate,
        deletedAt: IsNull(),
      },
    });
    if (existingLog) {
      throw new ConflictException(VEHICLE_LOG_ERRORS.DUPLICATE_LOG);
    }

    // Check for pending logs from previous days
    await this.checkPendingLogs(vehicleId, logDate);

    // Validate odometer sequence against previous day
    await this.validateStartOdometerSequence(vehicleId, logDate, createDto.startOdometerReading);

    // Get driver's site allocation on log date
    const siteAllocation = await this.getAllocationOnDate(driverId, logDate);
    const siteId = siteAllocation?.siteId || null;

    // Determine status and calculated fields
    let status = VehicleLogStatus.STARTED;
    let totalKmTraveled: number | null = null;
    let anomalyDetected = false;
    let anomalyReason: string | null = null;

    // If end odometer provided, complete the log
    if (createDto.endOdometerReading !== undefined) {
      if (createDto.endOdometerReading < createDto.startOdometerReading) {
        throw new BadRequestException(VEHICLE_LOG_ERRORS.INVALID_ODOMETER);
      }

      // Validate against next day
      await this.validateEndOdometerSequence(vehicleId, logDate, createDto.endOdometerReading);

      status = VehicleLogStatus.COMPLETED;
      totalKmTraveled = createDto.endOdometerReading - createDto.startOdometerReading;

      // Check for anomaly and get descriptive reason
      const anomalyResult = await this.checkAnomaly(siteId, totalKmTraveled);
      anomalyDetected = anomalyResult.detected;
      anomalyReason = anomalyResult.reason;
    }

    // Create vehicle log
    const vehicleLog = await this.vehicleLogsRepository.create({
      vehicleId,
      driverId,
      siteId,
      logDate,
      status,
      startOdometerReading: createDto.startOdometerReading,
      startTime: createDto.startTime,
      startLocation: createDto.startLocation,
      endOdometerReading: createDto.endOdometerReading,
      endTime: createDto.endTime,
      endLocation: createDto.endLocation,
      totalKmTraveled,
      anomalyDetected,
      anomalyReason,
      purpose: createDto.purpose,
      driverRemarks: createDto.driverRemarks,
      createdBy: userId,
    });

    // Create file records
    await this.createFileRecords(vehicleLog.id, userId, fileData);

    const message =
      status === VehicleLogStatus.COMPLETED
        ? VEHICLE_LOG_RESPONSES.COMPLETED
        : VEHICLE_LOG_RESPONSES.STARTED;

    return { message, data: vehicleLog };
  }

  async update(
    id: string,
    updateDto: UpdateVehicleLogDto,
    userId: string,
    userRole: string,
    fileData: {
      startOdometerFiles?: string[];
      endOdometerFiles?: string[];
      otherFiles?: string[];
    } = {},
    timezone?: string,
  ) {
    const existingLog = await this.findOneOrFail({ where: { id, deletedAt: IsNull() } });

    // Use DateTimeService for timezone-aware date handling
    const tz = this.dateTimeService.getSafeTimezone(timezone);
    const logDateStr = this.dateTimeService.toDateString(existingLog.logDate);

    // Check if updating old entries (beyond allowed days) - timezone-aware
    await this.checkBackfillPermission(logDateStr, userRole, tz);

    // Only HR/Admin can set odometer reset flag
    if (updateDto.odometerResetFlag !== undefined && !this.isHrOrAdmin(userRole)) {
      delete updateDto.odometerResetFlag;
    }

    // Build update payload
    const updatePayload: Partial<VehicleLogEntity> = { ...updateDto, updatedBy: userId };

    // Get current/new readings
    const startReading = updateDto.startOdometerReading ?? existingLog.startOdometerReading;
    const endReading = updateDto.endOdometerReading ?? existingLog.endOdometerReading;

    // Validate odometer readings
    if (endReading !== null && endReading !== undefined && endReading < startReading) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.INVALID_ODOMETER);
    }

    // Validate sequence against adjacent days
    if (updateDto.startOdometerReading !== undefined) {
      await this.validateStartOdometerSequence(
        existingLog.vehicleId,
        existingLog.logDate,
        startReading,
        id,
      );
    }

    // Check if completing the log (adding end odometer to a STARTED log)
    const isCompleting =
      existingLog.status === VehicleLogStatus.STARTED && updateDto.endOdometerReading !== undefined;

    // Validate end odometer sequence when completing or updating completed log
    if (isCompleting && endReading !== null && endReading !== undefined) {
      await this.validateEndOdometerSequence(
        existingLog.vehicleId,
        existingLog.logDate,
        endReading,
        id,
      );
      updatePayload.status = VehicleLogStatus.COMPLETED;
    }

    // Validate end odometer if already completed and being updated
    if (
      existingLog.status === VehicleLogStatus.COMPLETED &&
      updateDto.endOdometerReading !== undefined &&
      endReading !== null &&
      endReading !== undefined
    ) {
      await this.validateEndOdometerSequence(
        existingLog.vehicleId,
        existingLog.logDate,
        endReading,
        id,
      );
    }

    // Recalculate total KM if log will be completed and end reading is available
    const willBeCompleted = isCompleting || existingLog.status === VehicleLogStatus.COMPLETED;
    const hasOdometerUpdate =
      updateDto.startOdometerReading !== undefined || updateDto.endOdometerReading !== undefined;

    if (willBeCompleted && hasOdometerUpdate && endReading !== null && endReading !== undefined) {
      updatePayload.totalKmTraveled = endReading - startReading;

      // Check for anomaly and get descriptive reason
      const anomalyResult = await this.checkAnomaly(
        existingLog.siteId,
        updatePayload.totalKmTraveled,
      );
      updatePayload.anomalyDetected = anomalyResult.detected;
      updatePayload.anomalyReason = anomalyResult.reason;
    }

    await this.vehicleLogsRepository.update({ id }, updatePayload);

    // Create file records
    await this.createFileRecords(id, userId, fileData);

    const message = isCompleting ? VEHICLE_LOG_RESPONSES.COMPLETED : VEHICLE_LOG_RESPONSES.UPDATED;
    return { message };
  }

  async findAll(options: GetVehicleLogDto) {
    const {
      vehicleId,
      driverId,
      siteId,
      status,
      logDate,
      fromDate,
      toDate,
      anomalyDetected,
      includeVehicle,
      includeDriver,
      includeSite,
      includeFiles,
      sortField = VEHICLE_LOG_SORTABLE_FIELDS[0],
      sortOrder = SortOrder.DESC,
      page = DefaultPaginationValues.PAGE,
      pageSize = DefaultPaginationValues.PAGE_SIZE,
    } = options;

    const where: FindOptionsWhere<VehicleLogEntity> = {
      deletedAt: IsNull(),
    };

    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    if (siteId) where.siteId = siteId;
    if (status) where.status = status;

    // Use DateTimeService for proper date parsing (avoids timezone issues)
    if (logDate) where.logDate = this.dateTimeService.toDate(logDate);
    if (fromDate && toDate) {
      where.logDate = Between(
        this.dateTimeService.toDate(fromDate),
        this.dateTimeService.toDate(toDate),
      );
    } else if (fromDate) {
      where.logDate = MoreThanOrEqual(this.dateTimeService.toDate(fromDate));
    } else if (toDate) {
      where.logDate = LessThanOrEqual(this.dateTimeService.toDate(toDate));
    }
    if (anomalyDetected !== undefined) where.anomalyDetected = anomalyDetected;

    const relations: string[] = [];
    if (includeVehicle) relations.push('vehicle');
    if (includeDriver) relations.push('driver');
    if (includeSite) relations.push('site');
    if (includeFiles) relations.push('files');

    const [records, totalRecords] = await this.vehicleLogsRepository.findAll({
      where,
      relations,
      order: { [sortField]: sortOrder as SortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return this.utilityService.listResponse(records, totalRecords);
  }

  async findOne(options: FindOneOptions<VehicleLogEntity>) {
    return await this.vehicleLogsRepository.findOne(options);
  }

  async findOneOrFail(options: FindOneOptions<VehicleLogEntity>): Promise<VehicleLogEntity> {
    const log = await this.vehicleLogsRepository.findOne(options);
    if (!log) {
      throw new NotFoundException(VEHICLE_LOG_ERRORS.NOT_FOUND);
    }
    return log;
  }

  async findById(id: string, includeRelations = true) {
    const relations = includeRelations
      ? ['vehicle', 'driver', 'site', 'files', 'createdByUser', 'updatedByUser']
      : [];
    const record = await this.findOneOrFail({
      where: { id, deletedAt: IsNull() },
      relations,
    });

    // Transform response to include user details
    return {
      ...record,
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
    };
  }

  // ============ HELPER METHODS ============

  private async resolveVehicleAndDriver(vehicleIdFromDto: string | undefined, userId: string) {
    let vehicleId = vehicleIdFromDto;
    let driverId = userId;

    if (!vehicleId) {
      // Find vehicle assigned to the logged-in user
      const userVehicle = await this.vehicleVersionsService.findOne({
        where: { assignedTo: userId, isActive: true },
      });
      if (!userVehicle) {
        throw new BadRequestException(VEHICLE_LOG_ERRORS.VEHICLE_NOT_ASSIGNED);
      }
      vehicleId = userVehicle.vehicleMasterId;
    } else {
      // If vehicleId provided, verify the vehicle exists and get assigned driver
      const vehicleVersion = await this.vehicleVersionsService.findOne({
        where: { vehicleMasterId: vehicleId, isActive: true },
      });
      if (!vehicleVersion) {
        throw new NotFoundException(VEHICLE_LOG_ERRORS.VEHICLE_NOT_FOUND);
      }
      if (!vehicleVersion.assignedTo) {
        throw new BadRequestException(VEHICLE_LOG_ERRORS.VEHICLE_NOT_ASSIGNED);
      }
      driverId = vehicleVersion.assignedTo;
    }

    return { vehicleId, driverId };
  }

  private async checkPendingLogs(vehicleId: string, currentLogDate: Date) {
    // Find any STARTED logs with dates before the current log date
    const pendingLogs = await this.vehicleLogsRepository.findAll({
      where: {
        vehicleId,
        status: VehicleLogStatus.STARTED,
        logDate: LessThan(currentLogDate),
        deletedAt: IsNull(),
      },
    });

    if (pendingLogs[0]?.length > 0) {
      throw new BadRequestException({
        message: VEHICLE_LOG_ERRORS.PENDING_LOGS_EXIST,
        pendingLogs: pendingLogs[0].map((log) => ({
          id: log.id,
          logDate: log.logDate,
          startOdometerReading: log.startOdometerReading,
        })),
      });
    }
  }

  private async validateStartOdometerSequence(
    vehicleId: string,
    logDate: Date,
    startOdometer: number,
    excludeId?: string,
  ) {
    const previousLog = await this.vehicleLogsRepository.findOne({
      where: {
        vehicleId,
        logDate: LessThan(logDate),
        status: VehicleLogStatus.COMPLETED,
        odometerResetFlag: false,
        deletedAt: IsNull(),
      },
      order: { logDate: SortOrder.DESC },
    });

    if (
      previousLog &&
      previousLog.id !== excludeId &&
      previousLog.endOdometerReading > startOdometer
    ) {
      throw new BadRequestException(
        VEHICLE_LOG_ERRORS.START_LESS_THAN_PREVIOUS_END.replace(
          '{start}',
          String(startOdometer),
        ).replace('{previousEnd}', String(previousLog.endOdometerReading)),
      );
    }
  }

  private async validateEndOdometerSequence(
    vehicleId: string,
    logDate: Date,
    endOdometer: number,
    excludeId?: string,
  ) {
    const nextLog = await this.vehicleLogsRepository.findOne({
      where: {
        vehicleId,
        logDate: MoreThan(logDate),
        odometerResetFlag: false,
        deletedAt: IsNull(),
      },
      order: { logDate: SortOrder.ASC },
    });

    if (nextLog && nextLog.id !== excludeId && nextLog.startOdometerReading < endOdometer) {
      throw new BadRequestException(
        VEHICLE_LOG_ERRORS.END_GREATER_THAN_NEXT_START.replace(
          '{end}',
          String(endOdometer),
        ).replace('{nextStart}', String(nextLog.startOdometerReading)),
      );
    }
  }

  private async checkBackfillPermission(logDateStr: string, userRole: string, timezone?: string) {
    // HR/Admin can always backfill
    if (this.isHrOrAdmin(userRole)) {
      return;
    }

    // Calculate days since log date using timezone-aware method
    const daysDiff = this.dateTimeService.getDaysSince(logDateStr, timezone);

    const backfillDaysAllowed = await this.getBackfillDaysAllowed();

    if (daysDiff > backfillDaysAllowed) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.ONLY_HR_ADMIN_CAN_BACKFILL);
    }
  }

  private async getBackfillDaysAllowed(): Promise<number> {
    const config = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.VEHICLE_LOG_BACKFILL_DAYS_ALLOWED,
        module: CONFIGURATION_MODULES.VEHICLE,
      },
    });

    if (!config) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.BACKFILL_DAYS_CONFIG_NOT_FOUND);
    }

    const settings = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    if (!settings.records.length || !settings.records[0].value) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.BACKFILL_DAYS_CONFIG_NOT_FOUND);
    }

    return Number(settings.records[0].value);
  }

  private isHrOrAdmin(role: string): boolean {
    return role === Roles.HR || role === Roles.ADMIN;
  }

  private async checkAnomaly(
    siteId: string | null,
    totalKmTraveled: number,
  ): Promise<{ detected: boolean; reason: string | null }> {
    // No anomaly check possible without site
    if (!siteId) {
      return { detected: false, reason: null };
    }

    const site = await this.siteService.findOne({ where: { id: siteId } });
    if (!site?.baseDistanceKm) {
      return { detected: false, reason: null };
    }

    const baseDistanceKm = Number(site.baseDistanceKm);
    const expectedDailyKm = baseDistanceKm * 2; // Round trip
    const threshold = await this.getAnomalyThreshold();
    const maxAllowedKm = expectedDailyKm * threshold;

    if (totalKmTraveled > maxAllowedKm) {
      // Build descriptive reason for the anomaly using constant template
      const reason = VEHICLE_LOG_ANOMALY_REASON.replace('{traveled}', String(totalKmTraveled))
        .replace('{maxAllowed}', String(Math.round(maxAllowedKm)))
        .replace('{siteName}', site.name)
        .replace('{baseDistance}', String(baseDistanceKm))
        .replace('{threshold}', String(threshold));
      return { detected: true, reason };
    }

    return { detected: false, reason: null };
  }

  private async getAnomalyThreshold(): Promise<number> {
    const config = await this.configurationService.findOne({
      where: {
        key: CONFIGURATION_KEYS.VEHICLE_LOG_ANOMALY_THRESHOLD,
        module: CONFIGURATION_MODULES.VEHICLE,
      },
    });

    if (!config) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.ANOMALY_THRESHOLD_CONFIG_NOT_FOUND);
    }

    const settings = await this.configSettingService.findAll({
      where: { configId: config.id, isActive: true },
    });

    if (!settings.records.length || !settings.records[0].value) {
      throw new BadRequestException(VEHICLE_LOG_ERRORS.ANOMALY_THRESHOLD_CONFIG_NOT_FOUND);
    }

    return Number(settings.records[0].value);
  }

  private async getAllocationOnDate(userId: string, date: Date) {
    return await this.siteAllocationService.findOne({
      where: {
        userId,
        allocatedAt: LessThanOrEqual(date),
        deallocatedAt: Or(IsNull(), MoreThanOrEqual(date)),
        deletedAt: IsNull(),
      },
    });
  }

  private async createFileRecords(
    vehicleLogId: string,
    userId: string,
    fileData: { startOdometerFiles?: string[]; endOdometerFiles?: string[]; otherFiles?: string[] },
  ) {
    const files: Partial<VehicleLogFileEntity>[] = [];

    if (fileData.startOdometerFiles?.length) {
      files.push(
        ...fileData.startOdometerFiles.map((fileKey) => ({
          vehicleLogId,
          fileType: VehicleLogFileType.START_ODOMETER,
          fileKey,
          createdBy: userId,
        })),
      );
    }

    if (fileData.endOdometerFiles?.length) {
      files.push(
        ...fileData.endOdometerFiles.map((fileKey) => ({
          vehicleLogId,
          fileType: VehicleLogFileType.END_ODOMETER,
          fileKey,
          createdBy: userId,
        })),
      );
    }

    if (fileData.otherFiles?.length) {
      files.push(
        ...fileData.otherFiles.map((fileKey) => ({
          vehicleLogId,
          fileType: VehicleLogFileType.OTHER,
          fileKey,
          createdBy: userId,
        })),
      );
    }

    if (files.length > 0) {
      await this.vehicleLogsRepository.createFiles(files);
    }
  }
}
